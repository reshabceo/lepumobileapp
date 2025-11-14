# 📦 How to Get the Lepu SDK AAR File

## 🎯 **Official Source: LepuDemo GitHub Repository**

The Lepu BLE Pro SDK AAR file is available from the official LepuDemo repository on GitHub.

---

## 📥 **Method 1: Download from GitHub Releases (Recommended)**

### **Step 1: Visit the Repository**
1. Go to: **https://github.com/viatom-develop/LepuDemo**
2. This is the official repository for Lepu's Android SDK

### **Step 2: Check Releases**
1. Click on **"Releases"** tab in the repository
2. Look for version **1.0.8** or the latest version
3. Download the **`lepu-blepro-1.0.8.aar`** file from the release assets

### **Step 3: Alternative - Clone Repository**
If the AAR is not in releases, you may need to build it from source:

```bash
# Clone the repository
git clone https://github.com/viatom-develop/LepuDemo.git

# Navigate to the repository
cd LepuDemo

# Look for the AAR file in the project structure
# Common locations:
# - app/libs/
# - libs/
# - build/outputs/aar/
```

---

## 📥 **Method 2: Extract from LepuDemo Project**

### **Step 1: Download LepuDemo Project**
1. Visit: **https://github.com/viatom-develop/LepuDemo**
2. Click **"Code"** → **"Download ZIP"**
3. Extract the ZIP file

### **Step 2: Find the AAR File**
The AAR file might be located in:
- `LepuDemo/app/libs/lepu-blepro-1.0.8.aar`
- `LepuDemo/libs/lepu-blepro-1.0.8.aar`
- `LepuDemo/build/outputs/aar/lepu-blepro-1.0.8.aar`

### **Step 3: Build from Source (If AAR Not Found)**
```bash
cd LepuDemo
./gradlew assembleRelease

# The AAR will be generated in:
# app/build/outputs/aar/app-release.aar
```

---

## 📥 **Method 3: Contact Wellue/Viatom Support**

If you cannot find the AAR file in the repository:

### **Option A: Wellue Official Website**
1. Visit: **https://www.getwellue.com/**
2. Look for **"Developer"** or **"SDK"** section
3. Contact support for SDK access

### **Option B: Viatom Support**
1. Email: **support@viatomtech.com**
2. Request: **"Lepu BLE Pro SDK AAR file for Android (version 1.0.8)"**
3. Mention: You need it for BP2 device integration

### **Option C: GitHub Issues**
1. Go to: **https://github.com/viatom-develop/LepuDemo/issues**
2. Create a new issue requesting the AAR file
3. Ask for: **"lepu-blepro-1.0.8.aar download link"**

---

## 📥 **Method 4: Check Maven Repository**

Some SDKs are published to Maven repositories:

### **Check Maven Central**
```bash
# Search for Lepu SDK
# Visit: https://search.maven.org/
# Search: "lepu" or "viatom" or "wellue"
```

### **Check JitPack**
```bash
# Visit: https://jitpack.io/
# Search: "viatom-develop/LepuDemo"
```

---

## 🔍 **What to Look For**

### **File Name Variations:**
- `lepu-blepro-1.0.8.aar` (exact match)
- `lepu-blepro-1.0.8-release.aar`
- `BleProLib-1.0.8.aar`
- `LepuBLEPro-1.0.8.aar`
- Any `.aar` file containing "lepu" or "blepro"

### **File Size:**
- Typically **500 KB - 2 MB**
- Contains compiled SDK classes

---

## 📋 **After Getting the AAR File**

### **Step 1: Place the File**
```bash
# Copy the AAR file to your project
cp lepu-blepro-1.0.8.aar /Users/mdsahil/Downloads/lepumobileapp/android/app/libs/
```

### **Step 2: Enable in build.gradle**
Edit `android/app/build.gradle`:
```gradle
dependencies {
    // ... existing dependencies ...
    
    // Uncomment this line:
    implementation(name: 'lepu-blepro-1.0.8', ext: 'aar')
}
```

### **Step 3: Register Plugins**
Edit `android/app/src/main/java/com/priti/app/MainActivity.java`:
```java
import com.priti.wellue.WelluePlugin;
import com.priti.app.plugins.Bp2Plugin;

@Override
public void onCreate(Bundle savedInstanceState) {
    registerPlugin(WelluePlugin.class);
    registerPlugin(Bp2Plugin.class);
    super.onCreate(savedInstanceState);
    // ...
}
```

### **Step 4: Remove Stub Classes (Optional)**
Once the real SDK is working, you can remove:
- `android/app/src/main/java/com/lepu/blepro/`

### **Step 5: Rebuild**
```bash
cd android
./gradlew clean assembleDebug
```

---

## 🔗 **Useful Links**

- **LepuDemo Repository:** https://github.com/viatom-develop/LepuDemo
- **Wellue Website:** https://www.getwellue.com/
- **Viatom Support:** support@viatomtech.com
- **GitHub Issues:** https://github.com/viatom-develop/LepuDemo/issues

---

## ⚠️ **Important Notes**

1. **Version Compatibility:** Make sure you get version **1.0.8** or compatible version
2. **License:** Check the license terms before using the SDK
3. **Documentation:** The repository may contain integration documentation
4. **Updates:** Check for newer versions that might have bug fixes

---

## 🆘 **If You Still Can't Find It**

1. **Check the repository README** for download instructions
2. **Look for "Releases"** section in the GitHub repository
3. **Check the "Wiki"** or "Documentation" sections
4. **Contact the repository maintainers** via GitHub Issues
5. **Check Wellue's official documentation** website

---

## ✅ **Verification**

After placing the AAR file, verify it's detected:

```bash
# Check if file exists
ls -lh android/app/libs/lepu-blepro-1.0.8.aar

# Should show file size (typically 500KB - 2MB)
```

When you rebuild the app, check Logcat for:
```
✅ Found BleServiceHelper class: com.lepu.blepro.ext.BleServiceHelper
✅ Real SDK detected (not stub class)
```

---

**Last Updated:** Based on LepuDemo GitHub repository information

