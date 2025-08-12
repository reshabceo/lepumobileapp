# 🔗 Automatic Bluetooth Device Scanner

## 🎯 **Connect Your BP2 Device Without MAC Address!**

Your application now has **automatic Bluetooth device discovery** - no MAC address needed!

## 📱 **How to Use the Bluetooth Scanner**

### **Step 1: Access the Scanner**
1. **Go to**: http://localhost:8080
2. **Navigate to**: Devices → LepuDemo Devices
3. **Click the blue button**: "Scan for Bluetooth Devices (No MAC Address Needed)"

### **Step 2: Connect Your Device**
1. **Turn on your BP2 device** and put it in pairing mode
2. **Click "Scan for Bluetooth Devices"** in the scanner
3. **Select your device** from the browser's Bluetooth dialog
4. **The device will automatically connect** and start monitoring

## 🔧 **How It Works**

### **Automatic Device Detection**
The scanner automatically detects your device type based on the device name:
- **BP2, BP3, Viatom** → Blood Pressure Monitor
- **ER1, ER2, ER3** → ECG Device  
- **PC-60FW, O2Ring** → Pulse Oximeter
- **Bioland-BGM** → Blood Glucose Meter

### **No MAC Address Required**
- **Automatic discovery** via Web Bluetooth API
- **Device ID generation** from Bluetooth device ID
- **Real-time connection** and data monitoring

## 🌐 **Browser Requirements**

### **Supported Browsers:**
- ✅ **Chrome** (Desktop & Mobile)
- ✅ **Edge** (Desktop & Mobile)
- ✅ **Opera** (Desktop & Mobile)
- ❌ **Safari** (Not supported)
- ❌ **Firefox** (Not supported)

### **HTTPS Required:**
- **Local development**: http://localhost:8080 works
- **Production**: Must use HTTPS for Bluetooth access

## 📊 **Real-time Data Flow**

```
📱 Your BP2 Device → 🌐 Browser (Bluetooth) → 🖥️ Backend API → 📺 Web Dashboard
```

1. **Device sends data** via Bluetooth
2. **Browser receives data** via Web Bluetooth API
3. **Data processed** and sent to backend
4. **Real-time updates** on web dashboard

## 🎯 **For Your BP2 Device**

### **Connection Steps:**
1. **Turn on your BP2** (the one with Serial Number: 2536303049)
2. **Put it in pairing mode** (check manual for exact method)
3. **Open**: http://localhost:8080/devices/lepu
4. **Click**: "Scan for Bluetooth Devices (No MAC Address Needed)"
5. **Click**: "Scan for Bluetooth Devices"
6. **Select your BP2** from the device list
7. **Device connects automatically** and starts monitoring

### **What You'll See:**
- ✅ Device appears in "Found Devices" list
- ✅ Status shows "Connected" (green)
- ✅ Real-time data when you take measurements
- ✅ Automatic data processing and storage

## 🔍 **Troubleshooting**

### **Device Not Found:**
- ✅ Check device is in pairing mode
- ✅ Ensure Bluetooth is enabled on your computer
- ✅ Try refreshing the page
- ✅ Check browser console for errors

### **Connection Failed:**
- ✅ Make sure you're using Chrome, Edge, or Opera
- ✅ Check device battery level
- ✅ Try re-pairing the device
- ✅ Restart the device

### **Permission Denied:**
- ✅ Allow Bluetooth access when prompted
- ✅ Check browser settings for Bluetooth permissions
- ✅ Try refreshing the page

## 🚀 **Advanced Features**

### **Automatic Data Processing:**
- **Blood Pressure**: Systolic, Diastolic, Mean, Pulse Rate
- **ECG**: Heart Rate, Waveform Data
- **Oximeter**: SpO2, Pulse Rate, PI
- **Glucose**: Value, Unit, Test Type

### **Real-time Monitoring:**
- **Live data updates** on web dashboard
- **Automatic data storage** in backend
- **WebSocket events** for real-time notifications
- **Device status monitoring**

## 📱 **Mobile Integration**

### **For Mobile Apps:**
The scanner works on mobile browsers too:
- **Chrome Mobile**: Full support
- **Edge Mobile**: Full support
- **Safari Mobile**: Not supported

### **Native Mobile Apps:**
For better performance, use the native mobile integration:
- **Android**: `backend/android-integration/`
- **iOS**: `backend/MOBILE_INTEGRATION.md`
- **React Native**: `react-native-ble-plx`

## 🎉 **Benefits of Automatic Scanner**

### **✅ No MAC Address Needed**
- Automatic device discovery
- No manual configuration required
- Works with any compatible device

### **✅ Easy to Use**
- One-click device connection
- Automatic device type detection
- Real-time status updates

### **✅ Cross-Platform**
- Works on desktop and mobile
- Supports multiple device types
- Browser-based (no app installation)

### **✅ Real-time Data**
- Live measurement monitoring
- Automatic data processing
- Instant dashboard updates

## 🔄 **Next Steps**

1. **✅ Try the scanner** with your BP2 device
2. **📊 Monitor real-time data** on the dashboard
3. **📱 Consider mobile app** for better performance
4. **🔗 Connect more devices** as needed

---

**🎉 You can now connect your BP2 device without needing the MAC address! Just use the automatic Bluetooth scanner in the web interface.** 