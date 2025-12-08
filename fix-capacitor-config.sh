#!/bin/bash
# Fix capacitor.config.json to include WellueSDK in packageClassList

CONFIG_FILE="ios/App/App/capacitor.config.json"

echo "🔧 Fixing $CONFIG_FILE to include WellueSDK..."

# Use sed to add WellueSDK to the root packageClassList
# This replaces the line after "packageClassList": [ with WellueSDK entry
if grep -q '"packageClassList": \[' "$CONFIG_FILE"; then
    # Check if WellueSDK is already there
    if ! grep -A 1 '"packageClassList": \[' "$CONFIG_FILE" | grep -q '"WellueSDK"'; then
        echo "Adding WellueSDK to packageClassList..."
        # macOS sed requires -i '' for in-place editing
        sed -i '' '/"packageClassList": \[/,/\]/ {
            /"packageClassList": \[/ {
                n
                s/^[[:space:]]*"/		"WellueSDK",\
&/
            }
        }' "$CONFIG_FILE"
        echo "✅ WellueSDK added to packageClassList"
    else
        echo "✅ WellueSDK already in packageClassList"
    fi
else
    echo "❌ packageClassList not found in config"
    exit 1
fi

echo "✅ Config file fixed!"
cat "$CONFIG_FILE"

