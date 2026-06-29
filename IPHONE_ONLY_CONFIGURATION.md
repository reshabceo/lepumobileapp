# iPhone-Only Configuration

Monitraq is an **iPhone-only** app. It is not a native iPad (Universal) app.

## Xcode / project settings (verified)

| Setting | Value | Meaning |
|--------|--------|---------|
| `TARGETED_DEVICE_FAMILY` | `1` | iPhone only |
| `SUPPORTED_PLATFORMS` | `iphoneos iphonesimulator` | No iPadOS target |
| `SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD` | `NO` | Not “Designed for iPad” on Mac |
| `SUPPORTS_XR_DESIGNED_FOR_IPHONE_IPAD` | `NO` | Not visionOS iPad mode |
| `SUPPORTS_MACCATALYST` | `NO` | No Mac Catalyst |
| `LSRequiresIPhoneOS` | `true` | iPhone OS required |
| `UIRequiresFullScreen` | `true` | No iPad Split View / Slide Over |

**Info.plist:** no `UISupportedInterfaceOrientations~ipad` key (iPad-specific orientations removed).

## App Store Connect (required when submitting)

1. **General → App Information**
   - Device support should show **iPhone** only (not Universal).
   - Do **not** upload iPad screenshots or iPad app previews.

2. **Pricing and Availability**
   - Territories: India + United States (as configured).

3. **App Review Information → Notes**
   - Paste text from `APP_STORE_REVIEW_NOTES.md`.
   - Include: *“This is an iPhone-only app (TARGETED_DEVICE_FAMILY = 1). Please review on iPhone. The app is not optimized for native iPad layout.”*

4. **Build**
   - Upload a new build after bumping **Build** number in Xcode (`CURRENT_PROJECT_VERSION`).
   - Select the new build on the version page before submitting.

## Important: iPhone apps on iPad

Apple may still install an iPhone-only app on iPad in **compatibility mode** (scaled iPhone window). Reviewers sometimes test on iPad even for iPhone-only apps.

That is why the **Health AI data sharing** dialog is scrollable (`max-h` + `overflow-y-auto`) so content is not cut off on smaller or scaled viewports.

You cannot fully remove the app from the iPad App Store listing while keeping iPhone distribution — but the binary is iPhone-only and must not declare iPad as a supported device family.

## Verify in Xcode before archive

1. Open `ios/App/App.xcworkspace`
2. Select target **App** → **General**
3. **Supported Destinations** should list **iPhone** only
4. **Signing & Capabilities** → Team + Automatic signing
5. **Product → Clean Build Folder** (⇧⌘K)
6. **Product → Archive** → Distribute to App Store Connect

## Build number

Current build: check `CURRENT_PROJECT_VERSION` in `ios/App/App.xcodeproj/project.pbxproj` (increment for each App Store submission).

---

**Status:** iPhone-only native target. Rebuild and upload a new IPA after any change to this configuration.
