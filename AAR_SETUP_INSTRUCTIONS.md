# AAR File Setup Instructions

**CRITICAL:** The Lepu SDK AAR file is required for BP2 device connections.

---

## Step 1: Download AAR File

The AAR file must be obtained from the official Lepu SDK repository:

**Source:** [https://github.com/viatom-develop/LepuDemo.git](https://github.com/viatom-develop/LepuDemo.git)

### Option A: Clone the Repository

```bash
git clone https://github.com/viatom-develop/LepuDemo.git
cd LepuDemo
# Look for the AAR file in the repository
# It may be in: app/libs/lepu-blepro-1.0.8.aar
```

### Option B: Download from Repository

1. Go to: https://github.com/viatom-develop/LepuDemo
2. Look for the AAR file in the repository
3. Download `lepu-blepro-1.0.8.aar`

---

## Step 2: Place AAR File

**Required Location:** `android/app/libs/lepu-blepro-1.0.8.aar`

```bash
# Create libs directory if it doesn't exist
mkdir -p android/app/libs

# Copy the AAR file to the libs directory
cp /path/to/lepu-blepro-1.0.8.aar android/app/libs/
```

**Verify:**
```bash
ls -lh android/app/libs/lepu-blepro-1.0.8.aar
```

**Expected output:**
```
-rw-r--r--  1 user  staff   3.6M Nov 14 10:00 android/app/libs/lepu-blepro-1.0.8.aar
```

---

## Step 3: Verify Build Configuration

The `build.gradle` file is already configured correctly:

```gradle
repositories {
    flatDir {
        dirs '../capacitor-cordova-android-plugins/src/main/libs', 'libs'
    }
    google()
    mavenCentral()
}

dependencies {
    // Nordic BLE library - REQUIRED by Lepu SDK
    implementation 'no.nordicsemi.android:ble:2.10.0'
    // Live event bus - REQUIRED by Lepu SDK
    implementation 'io.github.jeremyliao:live-event-bus-x:1.8.0'
    // Lepu BLE Pro SDK AAR for BP2 support
    implementation(name: 'lepu-blepro-1.0.8', ext: 'aar')
}
```

---

## Step 4: Build the App

After placing the AAR file:

```bash
cd android
./gradlew clean assembleDebug
```

**Check for errors:**
- If you see "Could not find lepu-blepro-1.0.8.aar", the file is not in the correct location
- If you see "ClassNotFoundException: BleServiceHelper", the AAR is not being included in the build

---

## AAR File Details

- **File Name:** `lepu-blepro-1.0.8.aar`
- **Size:** ~3.6 MB
- **Version:** 1.0.8
- **Supports:** BP2, BP2A, BP2T devices
- **Source:** Official Lepu SDK from GitHub

---

## Verification

After placing the AAR file and building, check logs:

```bash
adb logcat | grep -E "MainApplication|BleServiceHelper"
```

**Success logs:**
```
MainApplication: ✅ BleServiceHelper initialized via Companion.initService()
MainApplication: ✅ Lepu SDK BleServiceHelper initialization completed
```

**Error logs (if AAR missing):**
```
MainApplication: ❌ CRITICAL: BleServiceHelper class not found - AAR file may be missing
```

---

## Alternative Location

The AAR can also be placed in:
- `android/capacitor-cordova-android-plugins/src/main/libs/lepu-blepro-1.0.8.aar`

Both locations are configured in `build.gradle`:
```gradle
flatDir {
    dirs '../capacitor-cordova-android-plugins/src/main/libs', 'libs'
}
```

---

**Status:** ⚠️ **AAR FILE REQUIRED**

Please download and place the AAR file before building the app.

