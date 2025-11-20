# Quick Start Guide for Driver App

## The Issue
You're getting this error: "dev server cannot open custom runtimes either because it does not target native platforms or because it is not targeting dev clients."

This happens because the app uses custom native modules (`expo-notifications`, `expo-dev-client`) that require a development build, not Expo Go.

## Solution

### Step 1: Build the Development Build (First Time)
```bash
cd driver
npx expo run:android
```

This will:
- Build the Android app with all native modules
- Install it on your device/emulator
- Start the Metro bundler automatically

### Step 2: Run the Dev Server (After First Build)
After the first build, you can use:
```bash
npm start
```

This will automatically use `--dev-client` flag (I've updated package.json).

Or manually:
```bash
npx expo start --dev-client
```

## Important Notes

1. **DO NOT use Expo Go** - It doesn't support custom native modules
2. **Development build is required** - Because we use `expo-notifications` plugin
3. **After first build** - You can use `npm start` for faster iterations
4. **Rebuild if needed** - If you add new native modules, run `npx expo prebuild --clean` then `npx expo run:android`

## Troubleshooting

### If you still get the error:
1. Make sure you're not using Expo Go
2. Verify `expo-dev-client` is in your `app.json` plugins (it is ✅)
3. Try rebuilding: `npx expo prebuild --clean && npx expo run:android`

### If push notifications don't work:
1. Make sure the app is built with `expo-notifications` plugin (it is ✅)
2. Check that Firebase is properly initialized (after rebuild)
3. Verify notification permissions are granted
4. Check logs for token generation and saving

## Current Status
- ✅ `expo-dev-client` plugin configured
- ✅ `expo-notifications` plugin configured  
- ✅ `package.json` updated to use `--dev-client` by default
- ✅ Android folder exists (prebuild already done)

You're ready to run: `npx expo run:android`

