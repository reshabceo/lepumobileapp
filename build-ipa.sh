#!/bin/bash

# iOS IPA Build Script for Monitraq App
# This script automates the process of building and exporting an IPA file

set -e  # Exit on error

echo "📱 =========================================="
echo "📱 iOS IPA Build Script"
echo "📱 =========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This script must be run on macOS"
    print_info "iOS apps can only be built on macOS"
    exit 1
fi

print_success "Running on macOS"

# Check if Xcode is installed
if ! command -v xcodebuild &> /dev/null; then
    print_error "Xcode is not installed"
    print_info "Please install Xcode from the App Store"
    print_info "Download: https://apps.apple.com/us/app/xcode/id497799835"
    exit 1
fi

XCODE_VERSION=$(xcodebuild -version | head -n 1)
print_success "Xcode installed: $XCODE_VERSION"

# Check if CocoaPods is installed
if ! command -v pod &> /dev/null; then
    print_warning "CocoaPods is not installed"
    print_info "Installing CocoaPods..."
    
    if sudo gem install cocoapods; then
        print_success "CocoaPods installed successfully"
    else
        print_error "Failed to install CocoaPods"
        print_info "Try manually: sudo gem install cocoapods"
        exit 1
    fi
else
    POD_VERSION=$(pod --version)
    print_success "CocoaPods installed: $POD_VERSION"
fi

# Navigate to project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

print_info "Project directory: $SCRIPT_DIR"

# Configuration
PROJECT_NAME="App"
SCHEME_NAME="App"
WORKSPACE_PATH="ios/App/App.xcworkspace"
BUILD_DIR="$SCRIPT_DIR/build"
ARCHIVE_PATH="$BUILD_DIR/Monitraq.xcarchive"
EXPORT_PATH="$BUILD_DIR/ipa"
IPA_NAME="Monitraq-$(date +%Y%m%d-%H%M%S).ipa"

# Create build directory
mkdir -p "$BUILD_DIR"
mkdir -p "$EXPORT_PATH"

print_info "Archive path: $ARCHIVE_PATH"
print_info "Export path: $EXPORT_PATH"

# Step 1: Clean previous builds
print_info "Step 1: Cleaning previous builds..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
mkdir -p "$EXPORT_PATH"
print_success "Cleaned previous builds"

# Step 2: Build web app
print_info "Step 2: Building web app..."
if npm run build; then
    print_success "Web app built successfully"
else
    print_error "Web app build failed"
    exit 1
fi

# Step 3: Sync to iOS
print_info "Step 3: Syncing to iOS..."
if npx cap sync ios; then
    print_success "Synced to iOS platform"
else
    print_error "iOS sync failed"
    exit 1
fi

# Step 4: Install CocoaPods dependencies
print_info "Step 4: Installing CocoaPods dependencies..."
cd ios/App

if pod install; then
    print_success "CocoaPods dependencies installed"
else
    print_error "Pod install failed"
    print_info "Try manually: cd ios/App && pod install"
    exit 1
fi

cd "$SCRIPT_DIR"

# Step 5: Clean Xcode build folder
print_info "Step 5: Cleaning Xcode build folder..."
xcodebuild clean \
    -workspace "$WORKSPACE_PATH" \
    -scheme "$SCHEME_NAME" \
    > /dev/null 2>&1 || true
print_success "Xcode build folder cleaned"

# Step 6: Archive the app
print_info "Step 6: Archiving the app (this may take several minutes)..."
print_warning "Make sure you have configured code signing in Xcode!"
echo ""

xcodebuild archive \
    -workspace "$WORKSPACE_PATH" \
    -scheme "$SCHEME_NAME" \
    -archivePath "$ARCHIVE_PATH" \
    -configuration Release \
    -allowProvisioningUpdates \
    CODE_SIGN_STYLE=Automatic \
    | xcpretty || xcodebuild archive \
    -workspace "$WORKSPACE_PATH" \
    -scheme "$SCHEME_NAME" \
    -archivePath "$ARCHIVE_PATH" \
    -configuration Release \
    -allowProvisioningUpdates \
    CODE_SIGN_STYLE=Automatic

if [ -d "$ARCHIVE_PATH" ]; then
    print_success "App archived successfully"
else
    print_error "Archive failed"
    print_info "Common issues:"
    print_info "  1. Code signing not configured"
    print_info "  2. Development team not selected"
    print_info "  3. Bundle identifier conflicts"
    print_info ""
    print_info "To fix:"
    print_info "  1. Open Xcode: open ios/App/App.xcworkspace"
    print_info "  2. Select the App target"
    print_info "  3. Go to Signing & Capabilities"
    print_info "  4. Select your Team"
    print_info "  5. Ensure 'Automatically manage signing' is checked"
    exit 1
fi

# Step 7: Create ExportOptions.plist for ad-hoc distribution
print_info "Step 7: Creating export options..."
EXPORT_OPTIONS_PATH="$BUILD_DIR/ExportOptions.plist"

cat > "$EXPORT_OPTIONS_PATH" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>development</string>
    <key>teamID</key>
    <string>TEAM_ID_PLACEHOLDER</string>
    <key>compileBitcode</key>
    <false/>
    <key>uploadSymbols</key>
    <true/>
    <key>signingStyle</key>
    <string>automatic</string>
</dict>
</plist>
EOF

# Try to get Team ID automatically
TEAM_ID=$(security find-identity -v -p codesigning | grep "Apple Development" | head -n 1 | sed -n 's/.*(\([A-Z0-9]*\)).*/\1/p' || echo "")

if [ -n "$TEAM_ID" ]; then
    print_info "Detected Team ID: $TEAM_ID"
    sed -i '' "s/TEAM_ID_PLACEHOLDER/$TEAM_ID/g" "$EXPORT_OPTIONS_PATH"
else
    print_warning "Could not auto-detect Team ID"
    print_info "You may need to manually set it in ExportOptions.plist"
fi

print_success "Export options created"

# Step 8: Export IPA
print_info "Step 8: Exporting IPA file..."

xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportPath "$EXPORT_PATH" \
    -exportOptionsPlist "$EXPORT_OPTIONS_PATH" \
    -allowProvisioningUpdates \
    | xcpretty || xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportPath "$EXPORT_PATH" \
    -exportOptionsPlist "$EXPORT_OPTIONS_PATH" \
    -allowProvisioningUpdates

# Find the generated IPA
GENERATED_IPA=$(find "$EXPORT_PATH" -name "*.ipa" | head -n 1)

if [ -f "$GENERATED_IPA" ]; then
    # Move and rename the IPA
    mv "$GENERATED_IPA" "$SCRIPT_DIR/$IPA_NAME"
    print_success "IPA exported successfully!"
    
    echo ""
    echo "🎉 =========================================="
    echo "🎉 IPA Build Complete!"
    echo "🎉 =========================================="
    echo ""
    print_success "IPA file location:"
    echo "   $SCRIPT_DIR/$IPA_NAME"
    echo ""
    
    # Get IPA file size
    IPA_SIZE=$(du -h "$SCRIPT_DIR/$IPA_NAME" | cut -f1)
    print_info "IPA file size: $IPA_SIZE"
    
    echo ""
    print_info "📲 How to install on your iPhone:"
    echo ""
    echo "Method 1: Using Finder (macOS Catalina or later)"
    echo "  1. Connect iPhone via USB"
    echo "  2. Open Finder"
    echo "  3. Select your iPhone in sidebar"
    echo "  4. Drag and drop the IPA file to your iPhone"
    echo ""
    echo "Method 2: Using Xcode"
    echo "  1. Connect iPhone via USB"
    echo "  2. Open Xcode > Window > Devices and Simulators"
    echo "  3. Select your iPhone"
    echo "  4. Click '+' under Installed Apps"
    echo "  5. Select the IPA file"
    echo ""
    echo "Method 3: Using 3uTools or similar (Windows/Mac)"
    echo "  1. Download 3uTools: www.3u.com"
    echo "  2. Connect iPhone"
    echo "  3. Go to Apps > Install"
    echo "  4. Select the IPA file"
    echo ""
    echo "Method 4: Using command line"
    echo "  xcrun devicectl device install app --device <DEVICE_ID> $SCRIPT_DIR/$IPA_NAME"
    echo ""
    print_warning "Note: The app is signed with a development certificate"
    print_warning "It will expire in 7 days if using a free Apple Developer account"
    print_warning "For a paid account, it will expire in 1 year"
    echo ""
    print_info "📧 To share the IPA:"
    echo "  - Email it as an attachment"
    echo "  - Upload to cloud storage (Dropbox, Google Drive, etc.)"
    echo "  - Use AirDrop"
    echo ""
    print_success "Done! 🚀"
    
else
    print_error "IPA export failed"
    print_info "Check the export log above for errors"
    print_info ""
    print_info "Common issues:"
    print_info "  1. Missing provisioning profile"
    print_info "  2. Certificate expired"
    print_info "  3. Team ID incorrect"
    exit 1
fi

# Clean up temporary files (keep archive for debugging)
print_info "Cleaning up temporary files..."
rm -rf "$EXPORT_PATH"
print_success "Cleanup complete"

echo ""
print_info "Archive kept at: $ARCHIVE_PATH"
print_info "You can delete it to save space: rm -rf '$ARCHIVE_PATH'"
echo ""






