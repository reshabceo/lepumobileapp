#!/bin/bash

# iOS Build Script for BP2 Connection App
# This script automates the iOS build process

set -e  # Exit on error

echo "🍎 =========================================="
echo "🍎 iOS Build Script for BP2 Connection"
echo "🍎 =========================================="
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

# Step 1: Build web app
print_info "Step 1: Building web app..."
if npm run build; then
    print_success "Web app built successfully"
else
    print_error "Web app build failed"
    exit 1
fi

# Step 2: Sync to iOS
print_info "Step 2: Syncing to iOS..."
if npx cap sync ios; then
    print_success "Synced to iOS platform"
else
    print_error "iOS sync failed"
    exit 1
fi

# Step 3: Install CocoaPods dependencies
print_info "Step 3: Installing CocoaPods dependencies..."
cd ios/App

if pod install; then
    print_success "CocoaPods dependencies installed"
else
    print_error "Pod install failed"
    print_info "Try manually: cd ios/App && pod install"
    exit 1
fi

# Step 4: Open Xcode
print_info "Step 4: Opening Xcode..."
print_warning "Make sure to:"
print_warning "  1. Select your development team"
print_warning "  2. Connect your iPhone"
print_warning "  3. Select your device in Xcode"
print_warning "  4. Click the Play button to run"
echo ""

if open App.xcworkspace; then
    print_success "Xcode opened successfully"
    print_success "Project workspace: ios/App/App.xcworkspace"
else
    print_error "Failed to open Xcode"
    print_info "Try manually: cd ios/App && open App.xcworkspace"
    exit 1
fi

echo ""
echo "🎉 =========================================="
echo "🎉 Build preparation complete!"
echo "🎉 =========================================="
echo ""
print_info "Next steps in Xcode:"
echo "  1. Wait for indexing to complete"
echo "  2. Select App target"
echo "  3. Go to Signing & Capabilities"
echo "  4. Check 'Automatically manage signing'"
echo "  5. Select your Team"
echo "  6. Connect iPhone via USB"
echo "  7. Select iPhone in device dropdown"
echo "  8. Click Play button (▶️) to build and run"
echo ""
print_info "Monitor Xcode Console for BP2 connection logs"
print_info "Filter by: WELLUE"
echo ""
print_success "Good luck! 🚀"

