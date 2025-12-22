# Monitraq APK Installation Guide

## 📱 APK Information

**File Name**: `Monitraq-FileUploadFixed-v1.1-20251219-182337.apk`  
**Location**: `/Users/mdsahil/Downloads/lepumobileapp/`  
**Size**: ~15 MB  
**Version**: 1.1  
**Build Date**: December 19, 2025  
**Package ID**: `com.priti.app`

## ✨ What's Fixed in This Version

### 🔧 File Upload Issues - FIXED!
- ✅ Added Android permissions for storage, files, and camera access
- ✅ Added network security configuration for proper HTTPS/Supabase connectivity
- ✅ Improved error handling with 2-minute timeout for mobile uploads
- ✅ Fixed package name configuration to prevent crashes
- ✅ Better error messages for network and upload issues

### 🆕 New Features
- ✅ Enhanced file upload with progress indicators
- ✅ Support for multiple file types (JPG, PNG, PDF, DOC, DOCX)
- ✅ Camera integration for taking photos directly
- ✅ Network state detection for better error reporting

## 📥 Installation Steps

### Step 1: Uninstall Old Version (If Installed)
⚠️ **IMPORTANT**: If you have a previous version of Monitraq installed, uninstall it first!

1. Go to **Settings** → **Apps** → **Monitraq**
2. Tap **Uninstall**
3. Confirm uninstallation

### Step 2: Transfer APK to Your Phone
Choose one of these methods:

**Method A: USB Cable**
```bash
# Connect phone via USB and transfer the APK
adb install /Users/mdsahil/Downloads/lepumobileapp/Monitraq-FileUploadFixed-v1.1-20251219-182337.apk
```

**Method B: File Transfer**
- Email the APK to yourself
- Use Google Drive, Dropbox, or any cloud storage
- Use a USB cable to copy directly to phone

### Step 3: Enable Installation from Unknown Sources
1. When you try to install, Android will ask for permission
2. Tap **Settings**
3. Enable **"Install unknown apps"** for your file manager/browser
4. Go back and tap **Install**

### Step 4: Install the APK
1. Open the APK file on your phone
2. Tap **Install**
3. Wait for installation to complete
4. Tap **Open** or find the app in your app drawer

### Step 5: Grant Permissions
When you first open the app, grant these permissions:
- ✅ **Storage/Files** - Required for uploading medical reports
- ✅ **Camera** - Required for taking photos of reports
- ✅ **Location** - Required for Bluetooth device connectivity
- ✅ **Bluetooth** - Required for connecting to medical devices

## 🧪 Testing the Fixed Upload Feature

### Test 1: Upload from Files
1. Open Monitraq app
2. Navigate to **Reports** → **Add Reports** (tap the + button)
3. Tap **"Upload from Files"**
4. Select an image or PDF file
5. Fill in the form:
   - **Report Type**: Select from dropdown
   - **Report Name**: Enter a name (e.g., "Blood Test")
   - **Doctor Name**: Enter doctor's name
6. Tap **"Save Report"**
7. ✅ Upload should succeed without network errors!

### Test 2: Take Photo
1. Go to **Reports** → **Add Reports**
2. Tap **"Take Photo"**
3. Grant camera permission if prompted
4. Take a photo of a document
5. Fill in the form fields
6. Tap **"Save Report"**
7. ✅ Photo should upload successfully!

### Test 3: Verify Upload
1. Go to **Reports** tab
2. Your newly uploaded report should appear in the list
3. Tap on it to view details
4. ✅ Confirm the file opens correctly

## ❓ Troubleshooting

### Problem: App Still Crashes on Startup
**Solution**:
1. Completely uninstall the old version
2. Clear app data: Settings → Apps → Monitraq → Storage → Clear Data
3. Restart your phone
4. Install the new APK again

### Problem: "App Not Installed" Error
**Solution**:
1. Make sure you uninstalled any previous version
2. Check that you have enough storage space (at least 50MB free)
3. Try installing from a different file manager

### Problem: Upload Still Shows Network Error
**Solution**:
1. Check your internet connection (try opening a website)
2. Make sure the app has these permissions:
   - Go to Settings → Apps → Monitraq → Permissions
   - Enable Storage, Camera, and Network
3. Try uploading a smaller file first (< 5MB)
4. Make sure you're on a stable WiFi or mobile data connection

### Problem: Camera Permission Denied
**Solution**:
1. Go to Settings → Apps → Monitraq → Permissions
2. Enable **Camera** permission
3. Return to the app and try again

### Problem: Can't Select Files
**Solution**:
1. Go to Settings → Apps → Monitraq → Permissions
2. Enable **Storage** or **Files and Media** permission
3. Try again

## 📊 System Requirements

- **Android Version**: 6.0 (API 23) or higher
- **Storage**: At least 50MB free space
- **Internet**: WiFi or mobile data connection required for uploads
- **Permissions**: Storage, Camera, Location, Bluetooth

## 🔒 Security Notes

- This is a **debug-signed APK** for testing purposes
- The package name is `com.priti.app`
- All network connections use HTTPS with proper SSL/TLS
- File uploads are encrypted in transit to Supabase
- For production deployment, use a release-signed APK

## 📞 Support

If you continue to experience issues:
1. Check the error message - it should now be more descriptive
2. Try with a smaller file (< 5MB) first
3. Ensure all app permissions are granted
4. Check that you have a stable internet connection
5. Try both WiFi and mobile data to isolate network issues

## 🎯 Next Steps After Successful Installation

1. ✅ Test file uploads with various file types (JPG, PNG, PDF)
2. ✅ Test camera photo capture
3. ✅ Test on different network conditions (WiFi, 4G, 5G)
4. ✅ Verify reports appear in the Reports list
5. ✅ Test Bluetooth device connectivity (if applicable)

---

**Build Complete!** Your Monitraq app with file upload fixes is ready to install and test. 🚀



