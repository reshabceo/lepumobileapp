#!/bin/bash

# iOS Build Script with WellueSDK Fix
# This script ensures WellueSDK is always in the packageClassList

set -e  # Exit on error

echo "🚀 Starting iOS build process..."

# Step 1: Build web assets
echo "📦 Building web assets..."
npm run build

# Step 2: Copy to iOS
echo "📋 Copying to iOS..."
export LANG=en_US.UTF-8
npx cap copy ios

# Step 3: Fix capacitor.config.json to ensure WellueSDK is in root packageClassList
echo "🔧 Fixing capacitor.config.json..."
CONFIG_FILE="ios/App/App/capacitor.config.json"

# Check if WellueSDK is in root packageClassList
if ! grep -q '"packageClassList"' "$CONFIG_FILE" | head -2 | tail -1 | grep -q "WellueSDK"; then
    echo "⚠️  WellueSDK missing from root packageClassList, adding it..."
    # Use perl to add WellueSDK to the root packageClassList (not ios.packageClassList)
    perl -i -0777 -pe 's/("packageClassList": \[(?!\s*"WellueSDK"))/\1\n\t\t"WellueSDK",/g' "$CONFIG_FILE"
    echo "✅ Added WellueSDK to root packageClassList"
else
    echo "✅ WellueSDK already in root packageClassList"
fi

# Verify the fix
echo "🔍 Verifying capacitor.config.json..."
if grep -A 5 '"packageClassList"' "$CONFIG_FILE" | grep -q "WellueSDK"; then
    echo "✅ Verification passed: WellueSDK is present"
else
    echo "❌ Verification failed: WellueSDK not found!"
    exit 1
fi

# Step 4: Build iOS app
echo "🏗️  Building iOS app..."
cd ios/App
xcodebuild -workspace App.xcworkspace \
           -scheme App \
           -configuration Debug \
           -destination 'platform=iOS,id=00008140-001C65993AE3001C' \
           build

# Step 5: Install on device
echo "📱 Installing on device..."
xcrun devicectl device install app \
      --device 00008140-001C65993AE3001C \
      ~/Library/Developer/Xcode/DerivedData/App-cvvdaoljxzghrlezsanitckwqigw/Build/Products/Debug-iphoneos/App.app

# Step 6: Launch app
echo "🚀 Launching app..."
xcrun devicectl device process launch \
      --device 00008140-001C65993AE3001C \
      com.monitraq.mobile

echo "✅ Build and deployment complete!"
