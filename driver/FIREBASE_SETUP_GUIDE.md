# Firebase Setup Guide - Getting google-services.json

This guide will help you get the `google-services.json` file from Firebase Console and add it to your project.

## Step-by-Step Instructions

### Step 1: Go to Firebase Console
1. Open your web browser
2. Go to: https://console.firebase.google.com/
3. Sign in with your Google account

### Step 2: Create or Select a Project
- **If you don't have a project:**
  1. Click "Add project" or "Create a project"
  2. Enter a project name (e.g., "Ridewave Driver")
  3. Click "Continue"
  4. (Optional) Enable Google Analytics if you want
  5. Click "Create project"
  6. Wait for project creation to complete
  7. Click "Continue"

- **If you already have a project:**
  1. Select your existing project from the list

### Step 3: Add Android App to Firebase Project
1. In your Firebase project dashboard, look for the gear icon (⚙️) next to "Project Overview" at the top
2. Click on the gear icon → Select "Project settings"
3. Scroll down to the "Your apps" section
4. Click the Android icon (🤖) to add an Android app
5. Fill in the app details:
   - **Android package name**: `com.becodemy.ridewavedriver`
     - ⚠️ **IMPORTANT**: This must match exactly!
   - **App nickname** (optional): "Ridewave Driver"
   - **Debug signing certificate SHA-1** (optional): Leave blank for now
6. Click "Register app"

### Step 4: Download google-services.json
1. After registering the app, you'll see a page with instructions
2. Look for the "Download google-services.json" button
3. Click the button to download the file
4. The file will be named `google-services.json`

### Step 5: Place the File in Your Project
1. Copy the downloaded `google-services.json` file
2. Navigate to your project directory: `driver/android/app/`
3. Paste the `google-services.json` file directly into the `android/app/` folder
4. The final path should be: `driver/android/app/google-services.json`

### Step 6: Verify File Location
The file structure should look like this:
```
driver/
  android/
    app/
      google-services.json  ← File should be here
      build.gradle
      src/
        ...
```

### Step 7: Rebuild the App
After adding the file, rebuild your app:

```bash
cd driver
npx expo prebuild --clean
npx expo run:android
```

## Verification

After rebuilding, check the logs. You should see:
- ✅ No Firebase initialization errors
- ✅ Push token generation working
- ✅ "✅ ===== PUSH TOKEN OBTAINED SUCCESSFULLY =====" in logs

## Troubleshooting

### Issue: Can't find "Add app" button
- Make sure you're in Project Settings (gear icon → Project settings)
- Scroll down to "Your apps" section
- The Android icon should be visible there

### Issue: Package name already exists
- If you see "This package name is already in use", you can:
  - Use the existing app configuration
  - Or create a new Firebase project

### Issue: File not found after download
- Check your browser's Downloads folder
- The file is named `google-services.json` (no spaces, lowercase)

### Issue: Still getting Firebase errors after adding file
1. Make sure the file is in the correct location: `driver/android/app/google-services.json`
2. Make sure you rebuilt the app after adding the file
3. Check that the package name in `google-services.json` matches: `com.becodemy.ridewavedriver`
4. Try cleaning the build: `cd driver/android && ./gradlew clean`

## Quick Reference

- **Firebase Console**: https://console.firebase.google.com/
- **Package name**: `com.becodemy.ridewavedriver`
- **File location**: `driver/android/app/google-services.json`
- **Rebuild command**: `npx expo prebuild --clean && npx expo run:android`

## Need Help?

If you're still having issues:
1. Verify the `google-services.json` file is in the correct location
2. Check that the package name in the file matches your app
3. Make sure you've rebuilt the app after adding the file
4. Check the Android logs for any specific error messages

