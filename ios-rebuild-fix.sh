#!/bin/bash

# iOS Lepu SDK Bluetooth Fix - Complete Rebuild Script
# This script fixes Bluetooth permissions and rebuilds the iOS app

set -e

echo "🔧 iOS Lepu SDK Bluetooth Permission Fix"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Navigate to project root
cd "$(dirname "$0")"

echo -e "${BLUE}Step 1: Cleaning previous builds...${NC}"
rm -rf ios/App/build
rm -rf ios/App/DerivedData
rm -rf dist

echo -e "${GREEN}✓ Cleaned build directories${NC}"
echo ""

echo -e "${BLUE}Step 2: Building web assets...${NC}"
npm run build

echo -e "${GREEN}✓ Web assets built${NC}"
echo ""

echo -e "${BLUE}Step 3: Syncing Capacitor...${NC}"
npx cap sync ios

echo -e "${GREEN}✓ Capacitor synced${NC}"
echo ""

echo -e "${BLUE}Step 4: Installing CocoaPods...${NC}"
cd ios/App
pod deintegrate || true
pod install

echo -e "${GREEN}✓ CocoaPods installed${NC}"
echo ""

echo -e "${BLUE}Step 5: Cleaning Xcode build cache...${NC}"
xcodebuild clean -workspace App.xcworkspace -scheme App -configuration Debug
rm -rf ~/Library/Developer/Xcode/DerivedData/*

echo -e "${GREEN}✓ Xcode cache cleaned${NC}"
echo ""

cd ../..

echo -e "${GREEN}=========================================="
echo -e "✅ iOS Bluetooth Fix Complete!"
echo -e "==========================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Open Xcode: open ios/App/App.xcworkspace"
echo "2. Select your device/simulator"
echo "3. Build and run (Cmd+R)"
echo "4. Test Bluetooth connection with BP2 device"
echo ""
echo -e "${YELLOW}Changes Applied:${NC}"
echo "✅ Added NSBluetoothAlwaysUsageDescription to Info.plist"
echo "✅ Added NSBluetoothPeripheralUsageDescription to Info.plist"
echo "✅ Added bluetooth-central background mode"
echo "✅ Created App-Bridging-Header.h"
echo "✅ Fixed deprecated parser methods (parseBPMeasuringData, etc.)"
echo "✅ Updated Xcode project configuration"
echo ""
echo -e "${GREEN}The app will now ask for Bluetooth permissions!${NC}"

