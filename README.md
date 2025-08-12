# 🏥 **Vital Signs Mobile View - Complete Medical Monitoring System**

A comprehensive real-time patient monitoring system with live vital signs, device management, and patient tracking. This application combines a React TypeScript frontend with a Node.js backend for complete medical device integration.

## 🚀 **Quick Start - One Command Setup**

```bash
# Clone and start everything with one command
git clone <repository-url>
cd vital-sign-mobile-view
npm install
npm run dev
```

**That's it!** Both frontend and backend will start automatically:
- **Frontend**: http://localhost:8080
- **Backend**: http://localhost:3000
- **Login**: `test@test.com` / `qweqwe`

## 📋 **Available Scripts**

```bash
npm run dev          # 🔥 Start both frontend & backend (RECOMMENDED)
npm run start        # 🚀 Production mode - both servers
npm run dev:frontend # Start only React frontend
npm run dev:backend  # Start only Node.js backend
npm run build        # Build frontend for production
```

## 🏥 **System Features**

### **Real-time Patient Monitoring**
- **5 Patients** with real medical conditions
- **15 Medical Devices** (3 per patient)
- **Live Data Updates** every 3-5 seconds
- **Real-time Charts** with animated visualizations

### **Device Types Supported**
- **Blood Pressure Monitors** (BP2, BP3, AirBP)
- **ECG Monitors** (ER1, ER2, ER3)
- **Pulse Oximeters** (PC-60FW, O2Ring, SP20)
- **Blood Glucose Meters** (BGM-100, LPM311)

### **Patient Data**
1. **John Smith** (42) - Hypertension
2. **Emily Johnson** (38) - Diabetes Type 2
3. **Michael Brown** (55) - Cardiac Arrhythmia
4. **Sarah Davis** (29) - Asthma
5. **Robert Wilson** (48) - Obesity

## 📱 **Application Flow**

```
Login → Dashboard → Patients → Live Monitor
  ↓         ↓          ↓          ↓
Auth    Overview   Patient    Real-time
System   Metrics    Cards      Charts
```

### **Navigation Pages**
- **🔐 Login** - JWT Authentication
- **📊 Dashboard** - Health overview from all patients
- **👥 Patients** - Patient cards with device status
- **📈 Live Monitor** - Real-time vital signs with charts
- **🔧 Device Details** - Technical device information
- **📋 Reports** - Historical data and analytics

## 🛠 **Technology Stack**

### **Frontend**
- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **Radix UI** components
- **React Query** for data fetching
- **React Router** for navigation
- **Recharts** for data visualization

### **Backend**
- **Node.js** with Express
- **Socket.io** for real-time updates
- **JWT** authentication
- **CORS** enabled
- **In-memory database** (demo)
- **Real-time data generation**

## 📊 **Live Data Features**

### **Real-time Updates**
- **Data Generation**: Every 5 seconds
- **Chart Updates**: Every 3 seconds
- **Device Status**: Battery, connection monitoring
- **Alert System**: Critical value notifications

### **Medical Accuracy**
- **Normal Ranges**: Based on medical standards
- **Status Colors**: Green (Normal), Yellow (Warning), Red (Critical)
- **Realistic Values**: Age and condition-appropriate data
- **Trend Analysis**: Historical pattern recognition

## 🔧 **Development Setup**

### **Project Structure**
```
vital-sign-mobile-view/
├── src/                 # React frontend
│   ├── components/      # UI components
│   ├── pages/          # Application pages
│   ├── hooks/          # Custom React hooks
│   └── lib/            # API services
├── backend/            # Node.js backend
│   ├── src/            # Backend source
│   └── package.json    # Backend dependencies
└── package.json        # Main project file
```

### **Environment Setup**
```bash
# Install all dependencies
npm install

# Backend dependencies (automatic)
cd backend && npm install

# Start development (both servers)
npm run dev
```

## 🔐 **Authentication**

**Demo Credentials:**
- **Email**: `test@test.com`
- **Password**: `qweqwe`

**JWT Features:**
- **24-hour tokens**
- **Automatic refresh**
- **Secure routes**
- **User session management**

## 📈 **API Endpoints**

### **Authentication**
```
POST /api/auth/login     # User login
GET  /api/auth/verify    # Token verification
```

### **Patient Management**
```
GET  /api/patients       # List all patients
GET  /api/patients/:id   # Get patient details
```

### **Device Management**
```
GET  /api/devices        # List all devices
GET  /api/devices/:id    # Get device info
```

### **Measurements**
```
GET  /api/bp/:id/history      # Blood pressure history
GET  /api/ecg/:id/history     # ECG recordings
GET  /api/oximeter/:id/history # SpO2 measurements
GET  /api/glucose/:id/history  # Glucose readings
```

## 🚀 **Deployment**

### **Development**
```bash
npm run dev              # Local development
```

### **Production**
```bash
npm run build           # Build frontend
npm run start          # Start production servers
```

### **Docker Support**
```bash
docker build -t vital-signs .
docker run -p 8080:8080 -p 3000:3000 vital-signs
```

## 🎯 **Key Features Demonstration**

### **Live Monitoring**
1. Login with demo credentials
2. Click **"Patients"** from dashboard
3. Click any **patient name**
4. Watch **real-time charts** update
5. Toggle between **Monitor** and **Device Details**

### **Real-time Data**
- **Animated bar charts** showing vital trends
- **Color-coded status** based on medical thresholds
- **Live pulse animations** on data visualization
- **Battery and connection monitoring**
- **Historical trend analysis**

## 📞 **Support & Documentation**

- **API Documentation**: `/backend/docs/`
- **Integration Guide**: `/backend/COMPLETE_INTEGRATION_GUIDE.md`
- **Test Client**: `/backend/test-client.html`
- **Mobile Integration**: `/backend/MOBILE_INTEGRATION.md`

## 🔄 **Real-time System Architecture**

```
Frontend (React) ←→ Backend (Node.js) ←→ Medical Devices
     ↓                    ↓                    ↓
 React Query         Express API         BLE Simulation
 WebSocket Client    Socket.io Server    Data Generation
 Chart Updates       JWT Auth            Device Management
```

## 🏆 **Demo Highlights**

- **🔴 Live Data Streaming** - Real medical data updates
- **📊 Interactive Charts** - Touch-friendly mobile interface  
- **⚡ Real-time Alerts** - Critical value notifications
- **🎨 Professional UI** - Hospital-grade design
- **📱 Mobile First** - Responsive across all devices
- **🔒 Secure Authentication** - JWT-based login system

---

## 🚀 **Get Started Now!**

```bash
npm install && npm run dev
```

Open http://localhost:8080 and login with `test@test.com / qweqwe` to see the complete medical monitoring system in action! 🏥✨