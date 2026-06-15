# 📱 IPA Build Guide - Install Monitraq on Your iPhone

This guide will help you create an IPA file and install it directly on your iPhone.

---

## 🎯 Quick Start (Easiest Method)

### Option 1: Automated Script (Recommended)

```bash
# Run the automated build script
./build-ipa.sh
```

**That's it!** The script will:
1. ✅ Build your web app
2. ✅ Sync to iOS
3. ✅ Install dependencies
4. ✅ Archive the app
5. ✅ Export IPA file
6. ✅ Save it with timestamp: `Monitraq-YYYYMMDD-HHMMSS.ipa`

**Time estimate:** 5-10 minutes

---

## 📋 Prerequisites

### 1. **Apple Developer Account**
- **Free account**: Works for 7 days, then needs re-signing
- **Paid account** ($99/year): Valid for 1 year

### 2. **Software Requirements**
- macOS 12.0 or later
- Xcode 14.0 or later (with Command Line Tools)
- Node.js and npm
- CocoaPods

### 3. **First-Time Setup**

**Install Xcode Command Line Tools:**
```bash
xcode-select --install
```

**Install CocoaPods (if not installed):**
```bash
sudo gem install cocoapods
```

**Configure Code Signing in Xcode:**
```bash
# Open the project
open ios/App/App.xcworkspace
```

In Xcode:
1. Select "App" project (left sidebar)
2. Select "App" target
3. Go to "Signing & Capabilities" tab
4. ✅ Check "Automatically manage signing"
5. Select your **Team** from dropdown (sign in if needed)
6. Verify Bundle Identifier is unique (e.g., `com.yourname.monitraq`)
7. Close Xcode

---

## 🚀 Building the IPA

### Method 1: Using the Build Script (Recommended)

```bash
# Navigate to project directory
cd /Users/mdsahil/Downloads/lepumobileapp

# Run the build script
./build-ipa.sh
```

**What happens:**
- Cleans previous builds
- Builds web app (`npm run build`)
- Syncs to iOS (`npx cap sync ios`)
- Installs CocoaPods dependencies
- Archives the app with Xcode
- Exports IPA file
- Saves to project root: `Monitraq-YYYYMMDD-HHMMSS.ipa`

**Success output:**
```
🎉 ==========================================
🎉 IPA Build Complete!
🎉 ==========================================

✅ IPA file location:
   /Users/mdsahil/Downloads/lepumobileapp/Monitraq-20251117-143022.ipa

ℹ️  IPA file size: 45M
```

---

### Method 2: Manual Build (Advanced)

If the script doesn't work, build manually:

**Step 1: Build web app**
```bash
npm run build
```

**Step 2: Sync to iOS**
```bash
npx cap sync ios
```

**Step 3: Install dependencies**
```bash
cd ios/App
pod install
cd ../..
```

**Step 4: Archive with Xcode**
```bash
xcodebuild archive \
  -workspace ios/App/App.xcworkspace \
  -scheme App \
  -archivePath build/Monitraq.xcarchive \
  -configuration Release \
  -allowProvisioningUpdates \
  CODE_SIGN_STYLE=Automatic
```

**Step 5: Export IPA**

Create `ExportOptions.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>development</string>
    <key>compileBitcode</key>
    <false/>
    <key>signingStyle</key>
    <string>automatic</string>
</dict>
</plist>
```

Export:
```bash
xcodebuild -exportArchive \
  -archivePath build/Monitraq.xcarchive \
  -exportPath build/ipa \
  -exportOptionsPlist ExportOptions.plist \
  -allowProvisioningUpdates
```

Your IPA will be in `build/ipa/App.ipa`

---

## 📲 Installing IPA on iPhone

### Method 1: Using Finder (macOS Catalina+) ⭐ Easiest

1. **Connect iPhone** to Mac via USB cable
2. **Trust the computer** on iPhone (if prompted)
3. **Open Finder**
4. **Select your iPhone** in the sidebar (under Locations)
5. **Drag and drop** the IPA file onto the iPhone window
6. Wait for installation to complete

**Troubleshooting:**
- If iPhone doesn't appear: Try different USB port, restart Finder
- If drag-drop doesn't work: Try Method 2

---

### Method 2: Using Xcode Devices Window

1. **Connect iPhone** via USB
2. **Open Xcode** (or any Xcode project)
3. Go to **Window > Devices and Simulators** (or `Cmd+Shift+2`)
4. Select your **iPhone** in left sidebar
5. Under **Installed Apps**, click the **+** button
6. **Browse and select** your IPA file
7. Click **Open**

**Success:** App appears in the Installed Apps list

---

### Method 3: Using Command Line (Developer)

```bash
# List connected devices
xcrun devicectl list devices

# Install IPA (replace DEVICE_ID with your device ID)
xcrun devicectl device install app \
  --device <DEVICE_ID> \
  Monitraq-20251117-143022.ipa
```

**For older Xcode versions:**
```bash
# List devices
idevice_id -l

# Install IPA
ideviceinstaller -i Monitraq-20251117-143022.ipa
```

---

### Method 4: Using Third-Party Tools

**3uTools (Windows/Mac):**
1. Download: [www.3u.com](http://www.3u.com)
2. Install and open 3uTools
3. Connect iPhone via USB
4. Go to **Apps** tab
5. Click **Install** button
6. Select IPA file
7. Wait for installation

**AltStore (Advanced):**
- Requires AltServer running on computer
- Good for sideloading without Xcode
- [altstore.io](https://altstore.io)

**Cydia Impactor (Deprecated):**
- No longer recommended
- Apple revoked certificates

---

## 🔐 First Launch - Trust Developer

After installation, the first time you open the app:

**You'll see: "Untrusted Enterprise Developer"**

**Fix:**
1. Go to iPhone **Settings**
2. Go to **General**
3. Scroll to **VPN & Device Management** (or **Device Management**)
4. Under "Developer App", tap your **Apple ID**
5. Tap **Trust "[Your Apple ID]"**
6. Confirm **Trust**
7. Go back and **launch the app** again

**Now it should open!** ✅

---

## ⏰ Certificate Expiration

### Free Apple Developer Account
- **Duration:** 7 days
- **What happens:** App stops opening after 7 days
- **Fix:** Rebuild and reinstall IPA

### Paid Apple Developer Account ($99/year)
- **Duration:** 1 year
- **What happens:** App stops opening after 1 year
- **Fix:** Rebuild and reinstall IPA

**To extend life:**
- Use TestFlight (requires paid account)
- Distribute via App Store (requires app review)

---

## 📧 Sharing IPA with Others

### ⚠️ Important Limitations

**Your IPA will ONLY work on:**
- ✅ Your own iPhone (registered with your Apple ID)
- ✅ iPhones registered in your Apple Developer account
- ❌ Other people's iPhones (will fail to install)

**Why?** The IPA is code-signed specifically for your account and provisioning profile.

### To Share Properly:

**Option 1: Ad-Hoc Distribution (Paid Account Only)**
1. Register UDIDs of recipient iPhones in developer portal
2. Create Ad-Hoc provisioning profile
3. Rebuild IPA with Ad-Hoc profile
4. Max 100 devices per year

**Option 2: TestFlight (Paid Account Only)**
1. Archive app in Xcode
2. Upload to App Store Connect
3. Add beta testers (up to 10,000 external)
4. Testers install via TestFlight app
5. Best method for sharing!

**Option 3: App Store (Paid Account + Review)**
1. Submit to App Store
2. Pass Apple's review process
3. Anyone can download
4. Takes 1-2 weeks for review

---

## 🐛 Troubleshooting

### Problem: "Code Signing Error"

**Error:**
```
Code signing "App.app" failed.
No signing certificate "iOS Development" found
```

**Fix:**
1. Open Xcode: `open ios/App/App.xcworkspace`
2. Select App target > Signing & Capabilities
3. Select your Team
4. Enable "Automatically manage signing"
5. Close Xcode and rebuild

---

### Problem: "Archive Failed"

**Error:**
```
xcodebuild: error: archive failed
```

**Fix:**
1. Clean build folder:
```bash
xcodebuild clean -workspace ios/App/App.xcworkspace -scheme App
```
2. Delete derived data:
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData
```
3. Reinstall pods:
```bash
cd ios/App
pod deintegrate
pod install
cd ../..
```
4. Rebuild

---

### Problem: "Export Failed"

**Error:**
```
error: exportArchive: No profiles for 'com.monitraq.mobile' were found
```

**Fix:**
1. Open Xcode: `open ios/App/App.xcworkspace`
2. Select target > Signing & Capabilities
3. Uncheck "Automatically manage signing"
4. Then re-check it (forces refresh)
5. Wait for provisioning profile to download
6. Close Xcode and rebuild

---

### Problem: "Installation Failed on iPhone"

**Error on iPhone:**
```
Unable to Install "Monitraq"
```

**Possible causes:**
1. **Wrong provisioning profile** - iPhone not registered
2. **Expired certificate** - Rebuild needed
3. **Bundle ID conflict** - Another app with same ID installed
4. **iOS version too old** - Requires iOS 14.0+

**Fix:**
```bash
# Check Bundle ID on iPhone (if app is installed)
# Settings > General > iPhone Storage > Monitraq

# Uninstall old version first
# Long-press app icon > Remove App

# Rebuild with new Bundle ID
# Edit in Xcode before building
```

---

### Problem: "App Crashes on Launch"

**Fix:**
1. Check Xcode console for crash logs
2. Verify all dependencies installed:
```bash
cd ios/App
pod install --repo-update
```
3. Rebuild in Debug mode first:
```bash
xcodebuild archive \
  -workspace ios/App/App.xcworkspace \
  -scheme App \
  -archivePath build/Monitraq.xcarchive \
  -configuration Debug \
  -allowProvisioningUpdates
```
4. Connect iPhone to Mac, open Xcode > Window > Devices and Simulators
5. View crash logs

---

### Problem: "Build Takes Forever"

**Optimization:**
1. Close other apps
2. Use USB-C cable (faster than USB-A)
3. Disable antivirus temporarily
4. Increase Xcode's memory:
```bash
defaults write com.apple.dt.Xcode IDEIndexingMaxMemoryPercentage 80
```
5. Use Release configuration (smaller, faster)

---

## 📊 Build Output Details

After successful build:

```
Monitraq-20251117-143022.ipa

Size: ~40-60 MB
Contains:
  - Compiled app binary
  - Assets and resources
  - Frameworks (Capacitor, Viatom SDK, etc.)
  - Provisioning profile
  - Code signature
```

**What's included:**
- ✅ Web app (dist/ folder)
- ✅ Native iOS code
- ✅ Capacitor plugins
- ✅ Viatom BP2 SDK
- ✅ CocoaPods dependencies
- ✅ Assets (icons, splash screens)

---

## 🔄 Rebuilding After Changes

**When to rebuild:**
- Changed web app code (TypeScript, React, etc.)
- Updated app version
- Modified native iOS code
- Certificate expired (every 7 days for free account)

**Quick rebuild:**
```bash
./build-ipa.sh
```

**Incremental build (web changes only):**
```bash
npm run build
npx cap copy ios
./build-ipa.sh
```

---

## 📱 Verifying Installation

**Check if app is installed:**
1. Look for "Monitraq" icon on home screen
2. Long-press icon > Info
3. Check version number

**Check if app is trusted:**
1. Settings > General > VPN & Device Management
2. Look for your Apple ID under Developer App
3. Should say "Verified"

**Check app permissions:**
1. Settings > Monitraq
2. Verify Bluetooth is enabled
3. Grant any other permissions needed

---

## 🎓 Advanced: TestFlight Distribution

For sharing with testers (requires paid Apple Developer account):

**Step 1: Archive in Xcode**
```bash
open ios/App/App.xcworkspace
```
- Product > Archive
- Wait for archive to complete
- Organizer window opens

**Step 2: Distribute to TestFlight**
- Click "Distribute App"
- Select "TestFlight & App Store"
- Select "Upload"
- Follow prompts
- App uploaded to App Store Connect

**Step 3: Add Testers**
- Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
- My Apps > Monitraq > TestFlight
- Add internal testers (up to 100)
- Add external testers (up to 10,000)
- Testers receive email invitation

**Step 4: Testers Install**
- Download TestFlight app from App Store
- Accept invitation email
- Tap "View in TestFlight"
- Install app

**Benefits:**
- ✅ 90-day expiration (auto-updated)
- ✅ Easy updates
- ✅ Crash reports
- ✅ Share with many people
- ✅ No device UDID needed

---

## 📞 Getting Help

**If build fails:**
1. Read error message carefully
2. Check troubleshooting section above
3. Verify all prerequisites installed
4. Try manual build method
5. Check Xcode directly:
```bash
open ios/App/App.xcworkspace
# Product > Archive in Xcode
```

**Useful commands:**
```bash
# Check Xcode version
xcodebuild -version

# Check CocoaPods version
pod --version

# Check provisioning profiles
security find-identity -v -p codesigning

# Check connected devices
xcrun devicectl list devices

# View recent archives
open ~/Library/Developer/Xcode/Archives
```

**Log files:**
- Build log: Check terminal output
- Archive log: ~/Library/Developer/Xcode/Archives/
- Crash logs: Xcode > Window > Devices and Simulators > View Device Logs

---

## ✅ Quick Checklist

Before building:
- [ ] Xcode installed and updated
- [ ] CocoaPods installed (`pod --version`)
- [ ] Signed in to Apple ID in Xcode
- [ ] Team selected in Xcode project
- [ ] Bundle ID is unique
- [ ] "Automatically manage signing" enabled
- [ ] Dependencies installed (`npm install`)
- [ ] Web app builds successfully (`npm run build`)

After building:
- [ ] IPA file exists in project folder
- [ ] IPA file size is reasonable (40-60 MB)
- [ ] iPhone connected via USB
- [ ] iPhone trusted computer
- [ ] Old version of app uninstalled (if any)

After installing:
- [ ] App icon visible on home screen
- [ ] Developer trusted in Settings
- [ ] App opens without crashing
- [ ] Bluetooth permission granted
- [ ] BP2 device connects successfully

---

## 🎉 Success!

You should now have:
- ✅ IPA file: `Monitraq-YYYYMMDD-HHMMSS.ipa`
- ✅ App installed on your iPhone
- ✅ App trusted and opening
- ✅ Ready to test BP2 connection!

**Next steps:**
1. Open Monitraq app on iPhone
2. Grant Bluetooth permission
3. Turn on BP2 device (hold power 3-5 seconds)
4. Tap "Connect" in app
5. Test blood pressure measurement

---

## 💡 Pro Tips

1. **Keep archives:** Don't delete .xcarchive files immediately (useful for crash symbolication)
2. **Version numbering:** Increment version before each build (easier to track)
3. **Build notes:** Keep a changelog of what's in each IPA
4. **Multiple IPAs:** Name includes timestamp - easy to identify latest
5. **Backup IPAs:** Keep copies in cloud storage
6. **Test on device:** Always test on real device, not simulator
7. **Battery:** Keep iPhone charged during installation
8. **Airplane mode:** Disable to reduce Bluetooth interference when testing
9. **Fresh build:** If issues, clean everything and rebuild from scratch
10. **Xcode open:** Keep Xcode closed during script build (can cause conflicts)

---

## App Store Connect — IAP v2 products (iOS payments)

The iOS app uses **Apple In-App Purchase** for all payments. See **[IAP_APP_STORE_CONNECT_V2.md](./IAP_APP_STORE_CONNECT_V2.md)** for the full product list and setup steps.

Before App Store submission:

1. Create all **v2** consumable and subscription products in App Store Connect.
2. Set status to **Ready to Submit** and attach them to the app version.
3. Test on a **physical device** with a **Sandbox Apple ID**.
4. Run migration `supabase/migrations/20260612000000_iap_products_v2.sql` for subscription `apple_product_id` values.

Android/web continue to use **Razorpay**.

---

**Good luck! 🚀**

If you encounter any issues not covered here, the error messages are usually very helpful. Read them carefully!






