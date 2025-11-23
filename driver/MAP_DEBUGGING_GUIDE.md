# Map Black Screen Debugging Guide

This guide helps you debug and fix the map black screen issue on some devices.

## What Was Implemented

### 1. Map Diagnostics Utility (`utils/mapDiagnostics.ts`)
- Checks API key configuration and validity
- Verifies Google Play Services availability (Android)
- Checks hardware acceleration support
- Logs device information for debugging

### 2. Error Handling
- Added `onMapReady`, `onError`, and `onDidFailLoadingMap` callbacks to all MapView instances
- Error messages displayed on screen when map fails
- Loading indicators while map initializes

### 3. Error Boundary Component (`components/map/MapErrorBoundary.tsx`)
- Catches JavaScript errors in map components
- Displays user-friendly error messages with solutions
- Provides retry functionality

### 4. Google Play Services Check (`components/map/GooglePlayServicesCheck.tsx`)
- Checks if Google Play Services is available (Android only)
- Shows warning message if unavailable
- Provides link to Play Store to update services

### 5. Map Initializer Component (`components/map/MapInitializer.tsx`)
- Wraps MapView with comprehensive checks
- Handles initialization and error states
- Provides fallback UI when map fails

### 6. Hardware Acceleration
- Enabled in `AndroidManifest.xml` with `android:hardwareAccelerated="true"`

## How to Debug

### Step 1: Check Console Logs

When the app starts, you should see diagnostic logs like:

```
🗺️ ===== MAP DIAGNOSTICS =====
Platform: android
API Key: ✅ Found
API Key Source: app.json (Android config)
API Key Format: ✅ Valid
Google Play Services: ✅ Available
Hardware Acceleration: ✅ Supported
Device Info: {...}
✅ No errors detected
=============================
```

### Step 2: Check for Specific Errors

Look for these error messages in the console:

- **"Google Maps API key not found"** → API key missing in configuration
- **"Google Maps API key format appears invalid"** → API key format is wrong
- **"Google Play Services not available"** → User needs to update Google Play Services
- **"Device may not support hardware acceleration"** → Device compatibility issue
- **"Map error: ..."** → Specific map rendering error

### Step 3: Verify API Key Configuration

1. **Check app.json**: Verify `android.config.googleMaps.apiKey` is set
2. **Check AndroidManifest.xml**: Verify `com.google.android.geo.API_KEY` meta-data exists
3. **Check environment variables**: Verify `EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY` if used

**Note**: The API key in `google-services.json` is for Firebase, not Google Maps. They can be different.

### Step 4: Test on Different Devices

#### On Emulator:
```bash
# Make sure emulator has Google Play Services
# Use an emulator with Google APIs (not just AOSP)
```

#### On Physical Device:
1. Check if device has Google Play Services installed
2. Update Google Play Services if needed
3. Check device Android version (should be API 21+)
4. Verify internet connection

### Step 5: Check Permissions

Ensure these permissions are granted:
- `ACCESS_FINE_LOCATION`
- `ACCESS_COARSE_LOCATION`
- `INTERNET`

## Common Issues and Solutions

### Issue 1: Black Screen on Some Devices

**Possible Causes:**
- Google Play Services not available/outdated
- API key restrictions (SHA-1 fingerprint not added)
- Hardware acceleration not supported
- Network connectivity issues

**Solutions:**
1. Check console logs for specific error
2. Verify API key has correct SHA-1 fingerprint added in Google Cloud Console
3. Update Google Play Services on device
4. Check if device supports hardware acceleration (most modern devices do)

### Issue 2: API Key Errors

**Symptoms:**
- Console shows "API key not found" or "Invalid format"
- Map shows error message

**Solutions:**
1. Verify API key in `app.json` matches the one in `AndroidManifest.xml`
2. Ensure API key is enabled for "Maps SDK for Android" in Google Cloud Console
3. Check API key restrictions (app package name, SHA-1)
4. Verify billing is enabled for the Google Cloud project

### Issue 3: Google Play Services Not Available

**Symptoms:**
- Warning message about Google Play Services
- Map doesn't load on Android devices

**Solutions:**
1. User needs to update Google Play Services from Play Store
2. Some devices (like Chinese phones) may not have Google Play Services
3. Consider using alternative map provider for these devices

### Issue 4: Hardware Acceleration Issues

**Symptoms:**
- Map renders but is slow or glitchy
- Black screen on very old devices

**Solutions:**
1. Hardware acceleration is now enabled by default
2. Very old devices (API < 14) may not support it
3. Consider showing fallback UI for unsupported devices

## Testing Checklist

- [ ] Test on emulator with Google Play Services
- [ ] Test on physical device without Google Play Services
- [ ] Test on low-end Android device
- [ ] Test with API key restrictions
- [ ] Test with location permissions denied
- [ ] Test with airplane mode (no internet)
- [ ] Test on different Android versions (API 21+)
- [ ] Check console logs for diagnostic information

## Using the MapInitializer Component (Optional)

If you want to use the comprehensive wrapper component:

```tsx
import MapInitializer from "@/components/map/MapInitializer";

<MapInitializer
  style={{ flex: 1 }}
  region={region}
  showsUserLocation={true}
  showDiagnostics={true}
>
  {/* Your markers and other map components */}
</MapInitializer>
```

## Getting SHA-1 Fingerprint for API Key

To add SHA-1 fingerprint to Google Cloud Console:

```bash
# Debug keystore
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# Release keystore (if you have one)
keytool -list -v -keystore your-release-key.keystore -alias your-key-alias
```

Add the SHA-1 fingerprint to your API key restrictions in Google Cloud Console.

## Additional Resources

- [React Native Maps Documentation](https://github.com/react-native-maps/react-native-maps)
- [Google Maps Platform Documentation](https://developers.google.com/maps/documentation)
- [Google Play Services](https://developers.google.com/android/guides/overview)

