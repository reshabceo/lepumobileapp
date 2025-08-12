#!/usr/bin/env node

console.log(`
🏥 ===============================================
    VITAL SIGNS MONITORING SYSTEM
    Starting Complete Medical Dashboard...
===============================================

🚀 QUICK START:
   Frontend: http://localhost:8080
   Backend:  http://localhost:3000
   Login:    test@test.com / qweqwe

📊 FEATURES:
   ✅ 5 Real Patients with Medical Conditions
   ✅ 15 Medical Devices (3 per patient)
   ✅ Real-time Data Updates (every 3-5 seconds)
   ✅ Live Charts & Animated Visualizations
   ✅ JWT Authentication System
   ✅ WebSocket Real-time Updates

🎯 TEST FLOW:
   1. Login with demo credentials
   2. Dashboard → Click "Patients" button
   3. Click any Patient Name
   4. Watch Live Monitor with Real-time Charts!
   5. Toggle between Monitor ↔ Device Details

🏥 PATIENTS:
   👨 John Smith (Hypertension)
   👩 Emily Johnson (Diabetes Type 2)  
   👨 Michael Brown (Cardiac Arrhythmia)
   👩 Sarah Davis (Asthma)
   👨 Robert Wilson (Obesity)

🔧 COMMANDS:
   npm run dev          - Start both servers
   npm run dev:frontend - Frontend only
   npm run dev:backend  - Backend only

===============================================
        🏥 Medical System Ready! 🏥
===============================================
`);

process.exit(0);