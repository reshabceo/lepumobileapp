#!/bin/bash
# Fix capacitor.config.json to include WellueSDK in packageClassList
# This script should be run after every 'npx cap copy ios' command

CONFIG_FILE="ios/App/App/capacitor.config.json"

echo "🔧 Fixing $CONFIG_FILE to include WellueSDK..."

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Config file not found: $CONFIG_FILE"
    exit 1
fi

# Check if WellueSDK is in the root packageClassList
if ! grep -A 10 '"packageClassList": \[' "$CONFIG_FILE" | grep -q '"WellueSDK"'; then
    echo "⚠️ WellueSDK missing from root packageClassList, adding it..."
    
    # Use Python for reliable JSON manipulation
    python3 << 'PYTHON_SCRIPT'
import json
import sys

config_file = "ios/App/App/capacitor.config.json"

try:
    with open(config_file, 'r') as f:
        config = json.load(f)
    
    # Ensure WellueSDK is in root packageClassList
    if 'packageClassList' in config:
        if 'WellueSDK' not in config['packageClassList']:
            config['packageClassList'].insert(0, 'WellueSDK')
            print("✅ Added WellueSDK to root packageClassList")
        else:
            print("✅ WellueSDK already in root packageClassList")
    else:
        config['packageClassList'] = ['WellueSDK']
        print("✅ Created packageClassList with WellueSDK")
    
    # Ensure WellueSDK is in iOS packageClassList
    if 'ios' in config and 'packageClassList' in config['ios']:
        if 'WellueSDK' not in config['ios']['packageClassList']:
            config['ios']['packageClassList'].insert(0, 'WellueSDK')
            print("✅ Added WellueSDK to iOS packageClassList")
    
    # Write back with proper formatting
    with open(config_file, 'w') as f:
        json.dump(config, f, indent='\t', ensure_ascii=False)
        f.write('\n')
    
    print("✅ Config file updated successfully!")
    
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
PYTHON_SCRIPT

    if [ $? -eq 0 ]; then
        echo "✅ WellueSDK added successfully"
    else
        echo "❌ Failed to add WellueSDK"
        exit 1
    fi
else
    echo "✅ WellueSDK already present in root packageClassList"
fi

echo "✅ Config file check complete!"
