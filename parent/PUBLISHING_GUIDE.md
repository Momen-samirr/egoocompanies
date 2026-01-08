# Publishing Guide for Parent App

## Overview

This guide walks you through publishing the Ridewave Parent app to your Expo developer account for device testing and production deployment.

## Prerequisites

1. **Expo Account**: Sign up at [expo.dev](https://expo.dev) if you don't have one
2. **EAS CLI**: Install globally with `npm install -g eas-cli`
3. **Environment Variables**: Configure your production API endpoints (see `ENV_SETUP.md`)

## Quick Start

### 1. Install EAS CLI and Login

```bash
npm install -g eas-cli
eas login
```

### 2. Initialize EAS Project

```bash
cd parent
eas build:configure
```

This will create/update `eas.json` with your project configuration.

### 3. Configure Environment Variables

#### Option A: Using EAS Secrets (Recommended for Production)

```bash
# Set production API URL
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://api.egoobus.com/api/v1"

# Set production WebSocket URL
eas secret:create --scope project --name EXPO_PUBLIC_WEBSOCKET_URL --value "wss://ws.egoobus.com"

# Set Google Maps API Key
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY --value "YOUR_API_KEY"
```

Then update `eas.json` to reference secrets:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "@expo-secret:EXPO_PUBLIC_API_URL",
        "EXPO_PUBLIC_WEBSOCKET_URL": "@expo-secret:EXPO_PUBLIC_WEBSOCKET_URL",
        "EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY": "@expo-secret:EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY"
      }
    }
  }
}
```

#### Option B: Hardcode in eas.json (Current Setup)

The current `eas.json` has production values hardcoded. Update them if needed:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.egoobus.com/api/v1",
        "EXPO_PUBLIC_WEBSOCKET_URL": "wss://ws.egoobus.com",
        "EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

### 4. Build for Testing (Preview)

#### Android APK (for device testing)

```bash
eas build --platform android --profile preview
```

This creates an APK file that can be installed directly on Android devices.

#### iOS (requires Apple Developer account)

```bash
eas build --platform ios --profile preview
```

### 5. Build for Production

#### Android App Bundle (for Google Play Store)

```bash
eas build --platform android --profile production
```

#### iOS (for App Store)

```bash
eas build --platform ios --profile production
```

**Note**: iOS builds require:

- Apple Developer account ($99/year)
- App Store Connect app record created
- Proper certificates and provisioning profiles (EAS handles this automatically)

### 6. Download and Install Builds

After the build completes:

1. You'll receive a QR code and download link
2. Scan the QR code with your device's camera (Android) or Expo Go app
3. Or download the APK/IPA file directly
4. Install on your device

### 7. Submit to App Stores (Optional)

#### Google Play Store

```bash
eas submit --platform android
```

**Requirements**:

- Google Play Developer account ($25 one-time fee)
- App bundle (.aab) file (use `buildType: "app-bundle"` in eas.json)
- Store listing information prepared

#### Apple App Store

```bash
eas submit --platform ios
```

**Requirements**:

- Apple Developer account ($99/year)
- App Store Connect app record
- App Store listing information prepared

## Build Profiles Explained

### Development

- Uses development client (expo-dev-client)
- For local development and testing
- Includes debugging tools

### Preview

- Production-like build for testing
- Android: Creates APK for direct installation
- iOS: Creates IPA for TestFlight or direct installation
- Good for internal testing

### Production

- Optimized for app stores
- Android: Creates App Bundle (.aab) for Google Play
- iOS: Creates IPA for App Store
- Includes code signing and optimization

## Environment Configuration Comparison

| Environment       | API URL                            | WebSocket URL             | Configuration Method          |
| ----------------- | ---------------------------------- | ------------------------- | ----------------------------- |
| **Local Dev**     | `http://192.168.1.105:8000/api/v1` | `ws://192.168.1.110:8080` | `.env` file                   |
| **Preview Build** | Same as production                 | Same as production        | `eas.json` preview profile    |
| **Production**    | `https://api.egoobus.com/api/v1`   | `wss://ws.egoobus.com`    | `eas.json` production profile |

## Troubleshooting

### Build Fails

1. **Check EAS status**: `eas build:list` to see build status
2. **View logs**: Click the build link in terminal or Expo dashboard
3. **Common issues**:
   - Missing environment variables
   - Invalid API keys
   - Bundle identifier conflicts
   - Missing certificates (iOS)

### Environment Variables Not Working

1. Verify variables start with `EXPO_PUBLIC_`
2. Check `eas.json` has correct values
3. For secrets, verify they're set: `eas secret:list`
4. Rebuild after changing environment variables

### App Crashes on Device

1. Check device logs: `adb logcat` (Android) or Xcode console (iOS)
2. Verify API endpoints are accessible from device
3. Check network permissions in app.json
4. Ensure production API is running and accessible

## Next Steps After Publishing

1. **Test thoroughly** on physical devices
2. **Monitor crash reports** via Expo dashboard
3. **Update version** in `app.json` for each release
4. **Submit to stores** when ready for public release

## Additional Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [Environment Variables Guide](ENV_SETUP.md)
- [Expo Dashboard](https://expo.dev)

## Current Configuration Summary

- **App Name**: Ridewave Parent
- **Slug**: ridewave-parent
- **Bundle ID (iOS)**: com.becodemy.ridewaveparent
- **Package (Android)**: com.becodemy.ridewaveparent
- **Version**: 1.0.0
- **Build System**: EAS Build
- **Environment**: Configured via `eas.json` and `.env`
