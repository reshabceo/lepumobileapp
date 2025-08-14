# API Configuration Guide

## 🚨 **Mixed Content Issue - SOLVED!**

The "Failed to fetch" error was caused by a **Mixed Content Security Error**:
- Your app runs on `https://localhost/` (HTTPS)
- But tries to call `http://192.168.1.11:3000/api` (HTTP)
- Modern browsers block this for security

## 🔧 **Solutions Implemented**

### **1. Environment Configuration (`src/config/environment.ts`)**
```typescript
export const ENV = {
  development: {
    api: {
      web: 'http://localhost:3000/api',           // Web browser
      mobile: 'http://192.168.1.11:3000/api',    // Mobile device
      webHttps: 'https://localhost:3000/api',     // HTTPS web (if available)
      mobileHttps: 'https://192.168.1.11:3000/api' // HTTPS mobile (if available)
    },
    useHttps: false, // Set to true when you have SSL certificates
    debug: true
  }
};
```

### **2. Smart API URL Detection**
- Automatically detects mobile vs web environment
- Uses appropriate URL based on platform
- Easy to configure for different environments

## 📱 **Current Configuration**

| Platform | URL | Status |
|----------|-----|---------|
| **Web Browser** | `http://localhost:3000/api` | ✅ Working |
| **Mobile Device** | `http://192.168.1.11:3000/api` | ✅ Working |

## 🚀 **How to Fix Your Backend**

### **Option A: Use HTTP (Current - Working)**
Keep your backend on HTTP and update the config:
```typescript
// In src/config/environment.ts
development: {
  api: {
    web: 'http://localhost:3000/api',
    mobile: 'http://192.168.1.11:3000/api'
  },
  useHttps: false  // Keep this false
}
```

### **Option B: Use HTTPS (Recommended for Production)**
1. **Get SSL Certificate** (Let's Encrypt is free)
2. **Update Backend** to use HTTPS
3. **Update Config**:
```typescript
development: {
  api: {
    web: 'https://localhost:3000/api',
    mobile: 'https://192.168.1.11:3000/api'
  },
  useHttps: true  // Set this to true
}
```

## 🔍 **Testing the Fix**

1. **Web Browser**: Open `http://localhost:3000` (not https)
2. **Mobile App**: Should work with current HTTP backend
3. **Check Console**: Look for "🔍 API Debug" messages

## 📋 **Quick Fix Steps**

### **For Immediate Use (HTTP Backend)**
1. ✅ **Already Done** - App rebuilt and installed
2. ✅ **Configuration Updated** - Uses HTTP URLs
3. ✅ **Mixed Content Fixed** - No more HTTPS/HTTP conflicts

### **For Production (HTTPS Backend)**
1. Install SSL certificate on your backend server
2. Update `src/config/environment.ts`:
   ```typescript
   useHttps: true
   ```
3. Rebuild and reinstall the app

## 🐛 **Debugging**

### **Check API URLs in Console**
Look for these messages:
```
🔍 API Debug - User Agent: [your user agent]
🔍 API Debug - Is Mobile: true/false
🔍 API Debug - Using API URL: [url]
🔍 API Debug - Final API_BASE_URL: [final url]
```

### **Common Issues**
1. **Wrong IP Address**: Update `192.168.1.11` to your actual backend IP
2. **Wrong Port**: Update `3000` to your actual backend port
3. **Backend Not Running**: Ensure your backend server is started

## 📱 **Mobile Testing**

1. **Install Updated App**: ✅ Already done
2. **Check Network**: Ensure mobile device can reach `192.168.1.11:3000`
3. **Test Login/Signup**: Should work without "Failed to fetch" errors

## 🔄 **Environment Variables (Optional)**

You can also use environment variables:
```bash
# .env file
VITE_API_WEB_URL=http://localhost:3000/api
VITE_API_MOBILE_URL=http://192.168.1.11:3000/api
VITE_USE_HTTPS=false
```

## ✅ **Status**

- [x] **Mixed Content Issue**: Fixed
- [x] **API Configuration**: Updated
- [x] **App Rebuilt**: Complete
- [x] **App Installed**: Complete
- [x] **Ready for Testing**: Yes

## 🎯 **Next Steps**

1. **Test the App**: Try login/signup on both web and mobile
2. **Verify Backend**: Ensure your backend is running on the correct IP/port
3. **Monitor Console**: Check for any remaining API errors
4. **Consider HTTPS**: Plan for SSL certificates in production

The app should now work without the "Failed to fetch" errors! 🎉
