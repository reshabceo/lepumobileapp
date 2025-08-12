# Medical Device API - Production Deployment Guide

## 🚀 Production Deployment Options

### Option 1: Docker Deployment

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

# Install system dependencies for Bluetooth
RUN apk add --no-cache \
    bluez \
    bluez-dev \
    python3 \
    make \
    g++ \
    linux-headers

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Add non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Start the application
CMD ["npm", "start"]
```

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  medical-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    volumes:
      - ./logs:/app/logs
    devices:
      - /dev/bus/usb:/dev/bus/usb  # USB Bluetooth adapter
    privileged: true  # Required for Bluetooth access
    restart: unless-stopped
    networks:
      - medical-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - medical-network

  mongodb:
    image: mongo:6
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password123
    volumes:
      - mongo_data:/data/db
    restart: unless-stopped
    networks:
      - medical-network

volumes:
  redis_data:
  mongo_data:

networks:
  medical-network:
    driver: bridge
```

Build and deploy:
```bash
# Build the image
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f medical-api

# Scale the API service
docker-compose up -d --scale medical-api=3
```

### Option 2: Cloud Deployment (AWS)

#### AWS EC2 Deployment

Create `deploy.sh`:
```bash
#!/bin/bash

# AWS EC2 deployment script
set -e

echo "🚀 Starting deployment to AWS EC2..."

# Update system
sudo yum update -y

# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install Bluetooth libraries
sudo yum install -y bluez bluez-libs bluez-utils

# Clone repository
git clone https://github.com/yourorg/lepu-medical-api.git
cd lepu-medical-api

# Install dependencies
npm ci --production

# Setup PM2 for process management
sudo npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'medical-api',
    script: 'src/app.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: '/var/log/medical-api.log',
    error_file: '/var/log/medical-api-error.log',
    out_file: '/var/log/medical-api-out.log',
    time: true
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Setup Nginx reverse proxy
sudo yum install -y nginx

cat > /etc/nginx/conf.d/medical-api.conf << EOF
upstream medical_api {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://medical_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://medical_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Start Nginx
sudo systemctl enable nginx
sudo systemctl start nginx

echo "✅ Deployment completed!"
echo "API available at: http://your-domain.com"
```

### Option 3: Raspberry Pi Deployment

For edge computing and local device communication:

```bash
# Install on Raspberry Pi OS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Bluetooth development libraries
sudo apt-get install -y bluetooth bluez libbluetooth-dev libudev-dev

# Enable Bluetooth service
sudo systemctl enable bluetooth
sudo systemctl start bluetooth

# Add user to Bluetooth group
sudo usermod -a -G bluetooth $USER

# Clone and setup
git clone https://github.com/yourorg/lepu-medical-api.git
cd lepu-medical-api
npm install

# Create systemd service
sudo tee /etc/systemd/system/medical-api.service > /dev/null <<EOF
[Unit]
Description=Medical Device API Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/lepu-medical-api
ExecStart=/usr/bin/node src/app.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl enable medical-api
sudo systemctl start medical-api
sudo systemctl status medical-api
```

## 🔒 Security Configuration

### Environment Variables (Production)

Create `.env.production`:
```env
# Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database
MONGODB_URL=mongodb://admin:password123@mongodb:27017/medical_devices?authSource=admin
REDIS_URL=redis://redis:6379

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this
API_KEY_SECRET=your-api-key-secret
RATE_LIMIT_WINDOW=900000  # 15 minutes
RATE_LIMIT_MAX=100        # requests per window

# SSL/TLS
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/medical-api.log

# Monitoring
SENTRY_DSN=your-sentry-dsn
NEW_RELIC_LICENSE_KEY=your-newrelic-key
```

### Security Middleware

Add to `src/middleware/security.js`:
```javascript
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');

// Rate limiting
const limiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW || 15 * 60 * 1000,
    max: process.env.RATE_LIMIT_MAX || 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// JWT Authentication
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Device ownership validation
const validateDeviceOwnership = async (req, res, next) => {
    const deviceId = req.params.deviceId;
    const userId = req.user.id;

    // Check if user has access to this device
    const hasAccess = await checkDeviceAccess(userId, deviceId);
    if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this device' });
    }

    next();
};

module.exports = {
    limiter,
    helmet: helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https:"],
            },
        },
    }),
    authenticateToken,
    validateDeviceOwnership
};
```

## 📊 Monitoring and Logging

### Health Checks

Create `src/middleware/health.js`:
```javascript
const os = require('os');

const healthCheck = (deviceManager) => {
    return (req, res) => {
        const health = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: os.loadavg(),
            system: {
                platform: os.platform(),
                arch: os.arch(),
                nodeVersion: process.version
            },
            devices: {
                discovered: deviceManager.getDeviceCount(),
                connected: deviceManager.getConnectedCount(),
                models: deviceManager.getSupportedModels()
            },
            bluetooth: {
                state: deviceManager.getBluetoothState(),
                scanning: deviceManager.isScanning()
            }
        };

        // Check critical services
        if (deviceManager.getConnectedCount() === 0) {
            health.status = 'warning';
            health.message = 'No devices connected';
        }

        if (!deviceManager.isBluetoothReady()) {
            health.status = 'error';
            health.message = 'Bluetooth not available';
            return res.status(503).json(health);
        }

        res.json(health);
    };
};

module.exports = { healthCheck };
```

### Logging Configuration

Create `src/utils/logger.js`:
```javascript
const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'medical-api' },
    transports: [
        new winston.transports.File({ 
            filename: path.join(process.env.LOG_FILE || './logs/error.log'),
            level: 'error'
        }),
        new winston.transports.File({ 
            filename: path.join(process.env.LOG_FILE || './logs/combined.log')
        })
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

module.exports = logger;
```

## 🧪 Testing and Quality Assurance

### Integration Tests

Create `tests/integration/device.test.js`:
```javascript
const request = require('supertest');
const { app, deviceManager } = require('../../src/app');

describe('Device Integration Tests', () => {
    let mockDevice;

    beforeEach(() => {
        mockDevice = {
            id: 'test-device-123',
            name: 'Test BP2',
            model: 'BP2',
            macAddress: '00:11:22:33:44:55'
        };
        
        // Mock device manager
        deviceManager.addMockDevice(mockDevice);
    });

    afterEach(() => {
        deviceManager.clearMockDevices();
    });

    describe('Blood Pressure Workflow', () => {
        test('Complete BP measurement workflow', async () => {
            // Connect device
            await request(app)
                .post(`/api/devices/${mockDevice.id}/connect`)
                .expect(200);

            // Start measurement
            const startResponse = await request(app)
                .post(`/api/bp/${mockDevice.id}/start-measurement`)
                .expect(200);

            expect(startResponse.body.success).toBe(true);

            // Simulate real-time data
            deviceManager.simulateBPData(mockDevice.id, {
                pressure: 120,
                pulseRate: 75
            });

            // Check real-time endpoint
            const realtimeResponse = await request(app)
                .get(`/api/bp/${mockDevice.id}/real-time`)
                .expect(200);

            expect(realtimeResponse.body.pressure).toBe(120);
        });
    });
});
```

### Load Testing

Create `tests/load/api-load.js`:
```javascript
const { check } = require('k6');
const http = require('k6/http');
const ws = require('k6/ws');

export let options = {
    stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
    ],
};

export default function() {
    // Test API endpoints
    let response = http.get('http://localhost:3000/health');
    check(response, {
        'status is 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500,
    });

    // Test WebSocket connections
    let url = 'ws://localhost:3000/socket.io/?EIO=4&transport=websocket';
    let ws_response = ws.connect(url, {}, function(socket) {
        socket.on('open', function() {
            console.log('WebSocket connected');
        });
        
        socket.on('message', function(data) {
            console.log('Received:', data);
        });
    });
}
```

## 📖 API Documentation

### OpenAPI/Swagger Setup

Create `docs/swagger.yaml`:
```yaml
openapi: 3.0.0
info:
  title: Medical Device API
  description: REST API for Lepu Medical Devices
  version: 1.0.0
  contact:
    name: API Support
    email: support@yourcompany.com

servers:
  - url: http://localhost:3000/api
    description: Development server
  - url: https://api.yourcompany.com/api
    description: Production server

paths:
  /devices:
    get:
      summary: List all discovered devices
      tags: [Device Management]
      responses:
        '200':
          description: List of devices
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Device'

  /devices/{deviceId}/connect:
    post:
      summary: Connect to a device
      tags: [Device Management]
      parameters:
        - name: deviceId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Device connected successfully
        '404':
          description: Device not found
        '500':
          description: Connection failed

  /bp/{deviceId}/start-measurement:
    post:
      summary: Start blood pressure measurement
      tags: [Blood Pressure]
      parameters:
        - name: deviceId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Measurement started
        '404':
          description: Device not connected
        '400':
          description: Device doesn't support BP measurement

components:
  schemas:
    Device:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        model:
          type: string
          enum: [BP2, BP3, AIRBP, ER1, ER2, ER3, PC60FW, O2RING, SP20]
        macAddress:
          type: string
        connected:
          type: boolean
        battery:
          $ref: '#/components/schemas/Battery'

    Battery:
      type: object
      properties:
        level:
          type: integer
          minimum: 0
          maximum: 100
        status:
          type: string
          enum: [normal, charging, low]

    BloodPressureResult:
      type: object
      properties:
        timestamp:
          type: string
          format: date-time
        systolic:
          type: integer
        diastolic:
          type: integer
        mean:
          type: integer
        pulseRate:
          type: integer
        result:
          type: string
        resultCode:
          type: integer
```

## 🎯 **Summary**

You now have a complete backend API implementation for Lepu medical devices with:

✅ **Device Communication**: BLE integration for all major device types  
✅ **REST API**: Comprehensive endpoints for device control  
✅ **Real-time Data**: WebSocket streaming for live measurements  
✅ **Security**: Authentication, rate limiting, and access control  
✅ **Deployment**: Docker, AWS, and Raspberry Pi options  
✅ **Monitoring**: Health checks, logging, and error tracking  
✅ **Testing**: Unit, integration, and load testing  
✅ **Documentation**: API docs and deployment guides  

The API supports:
- **Blood Pressure Monitors** (BP2, BP3, AirBP)
- **ECG Devices** (ER1, ER2, ER3) 
- **Pulse Oximeters** (PC-60FW, O2Ring)
- **Blood Glucose Meters**

Start with the development setup, test with your devices, then deploy to production! 🚀