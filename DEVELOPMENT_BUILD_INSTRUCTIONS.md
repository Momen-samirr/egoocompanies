# Development Build Instructions for react-native-maps

## Problem
Expo Go does NOT support react-native-maps. You need a development build to use native modules like react-native-maps.

## Solution
We've configured both apps with `expo-dev-client`. Now you need to build and run a development build.

## Steps to Build and Run

### For User App (RideWave)

1. **Navigate to the user directory:**
   ```bash
   cd user
   ```

2. **Install dependencies (if needed):**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Rebuild native code with the new expo-dev-client plugin:**
   ```bash
   npx expo prebuild --clean
   ```
   This will regenerate the Android/iOS native folders with the expo-dev-client plugin.

4. **Build and run on Android:**
   ```bash
   npx expo run:android
   ```
   This will:
   - Build the native Android app with expo-dev-client
   - Install it on your connected device/emulator
   - Start the Metro bundler

5. **Alternative: Start dev client manually**
   ```bash
   npx expo start --dev-client
   ```
   Then open the app on your device (it should be installed from step 4).

### For Driver App (Ridewave-Driver)

1. **Navigate to the driver directory:**
   ```bash
   cd driver
   ```

2. **Install dependencies:**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Rebuild native code:**
   ```bash
   npx expo prebuild --clean
   ```

4. **Build and run:**
   ```bash
   npx expo run:android
   ```

## Important Notes

- **DO NOT use Expo Go** - It won't work with react-native-maps
- The development build includes all native modules, so react-native-maps will work
- After the first build, you can use `npx expo start --dev-client` for faster iterations
- The development build needs to be rebuilt when you add new native modules or plugins

## Using EAS Build (Alternative)

If you prefer cloud builds:

1. **Install EAS CLI:**
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo:**
   ```bash
   eas login
   ```

3. **Configure EAS (if not already done):**
   ```bash
   eas build:configure
   ```

4. **Build development build:**
   ```bash
   eas build --profile development --platform android
   ```

5. **Install the build on your device** and then run:
   ```bash
   npx expo start --dev-client
   ```

## Troubleshooting

- If you see "Expo Go does NOT support react-native-maps" error, make sure you're using the development build, not Expo Go
- Make sure your Google Maps API key is correctly configured in `app.json`
- For Android, ensure you have the Google Play Services installed on your emulator/device
- If maps don't load, check that your API key has the Maps SDK for Android enabled in Google Cloud Console

