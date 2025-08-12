#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🏥 Lepu Medical Device API - Setup Script');
console.log('=========================================\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', 'env.example');

if (!fs.existsSync(envPath)) {
    console.log('📋 Creating .env file from template...');

    if (fs.existsSync(envExamplePath)) {
        fs.copyFileSync(envExamplePath, envPath);
        console.log('✅ .env file created successfully');
    } else {
        console.log('⚠️  env.example not found, creating basic .env...');
        const basicEnv = `PORT=3000
NODE_ENV=development
BLE_SCAN_TIMEOUT=30000
LOG_LEVEL=debug
`;
        fs.writeFileSync(envPath, basicEnv);
        console.log('✅ Basic .env file created');
    }
} else {
    console.log('✅ .env file already exists');
}

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].slice(1));

console.log(`📋 Node.js version: ${nodeVersion}`);

if (majorVersion < 16) {
    console.log('⚠️  Warning: Node.js 16+ is recommended for optimal performance');
} else {
    console.log('✅ Node.js version is compatible');
}

// Check if package.json exists
const packagePath = path.join(__dirname, '..', 'package.json');
if (fs.existsSync(packagePath)) {
    console.log('✅ package.json found');
} else {
    console.log('❌ package.json not found');
    process.exit(1);
}

console.log('\n🚀 Quick Start Instructions:');
console.log('1. Run: npm install');
console.log('2. Run: npm run dev');
console.log('3. Open: http://localhost:3000/api/health');
console.log('4. Check: TEST_GUIDE.md for testing instructions');

console.log('\n📱 Supported Devices:');
console.log('• Blood Pressure: BP2, BP3, AirBP');
console.log('• ECG: ER1, ER2, ER3');
console.log('• Pulse Oximeters: PC-60FW, O2Ring, SP20');
console.log('• Glucose Meters: Bioland-BGM');

console.log('\n📖 Documentation:');
console.log('• README.md - Overview and API docs');
console.log('• TEST_GUIDE.md - Testing instructions');
console.log('• docs/SETUP_GUIDE.md - Detailed setup');
console.log('• docs/DEPLOYMENT_GUIDE.md - Production deployment');

console.log('\n🔧 Common Commands:');
console.log('npm run dev     - Start development server');
console.log('npm test        - Run test suite');
console.log('npm start       - Start production server');

console.log('\n🎯 Next Steps:');
console.log('1. Ensure Bluetooth is enabled on your system');
console.log('2. Have your Lepu medical device ready');
console.log('3. Start the API server: npm run dev');
console.log('4. Test device discovery: curl http://localhost:3000/api/devices');

console.log('\n🏥 Ready to connect your medical devices! 🚀\n');