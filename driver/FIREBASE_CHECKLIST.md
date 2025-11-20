# Firebase Setup Checklist

## ✅ What I've Already Added (DO NOT REMOVE)

1. ✅ Firebase initialization in `MainApplication.kt`
2. ✅ Google Services plugin in `android/build.gradle`
3. ✅ Google Services plugin in `android/app/build.gradle`
4. ✅ Firebase dependencies in `android/app/build.gradle`

## ❌ What You Still Need to Do

### Step 1: Get google-services.json from Firebase Console

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Create or Select Project**:
   - If new: Click "Add project" → Enter name → Continue
   - If existing: Select from list
3. **Add Android App**:
   - Click gear icon (⚙️) → "Project settings"
   - Scroll to "Your apps" section
   - Click Android icon (🤖)
   - **Package name**: `com.becodemy.ridewavedriver` (MUST match exactly!)
   - Click "Register app"
4. **Download File**:
   - Click "Download google-services.json"
   - Save the file

### Step 2: Place the File

1. Copy the downloaded `google-services.json` file
2. Place it here: `driver/android/app/google-services.json`
3. **Verify the path**: `/home/momen-samir/Work/ecar (Copy)/driver/android/app/google-services.json`

### Step 3: Verify File is in Place

Run this command to check:
```bash
ls -la driver/android/app/google-services.json
```

You should see the file listed. If not, the file is in the wrong location.

### Step 4: Rebuild the App

**IMPORTANT**: You MUST rebuild after adding the file:

```bash
cd driver
npx expo prebuild --clean
npx expo run:android
```

## Why Both Are Needed

- **Firebase Code** (already added): Initializes Firebase in your app
- **google-services.json** (you need to add): Contains Firebase project configuration

**Without BOTH, push notifications will NOT work!**

## Quick Verification

After rebuilding, check logs for:
- ✅ No "FirebaseApp is not initialized" errors
- ✅ "✅ ===== PUSH TOKEN OBTAINED SUCCESSFULLY =====" message
- ✅ Push token generated successfully

## Troubleshooting

### Still getting Firebase errors?
1. ✅ Verify `google-services.json` is in `driver/android/app/` folder
2. ✅ Verify package name in file matches: `com.becodemy.ridewavedriver`
3. ✅ Make sure you ran `npx expo prebuild --clean` before `npx expo run:android`
4. ✅ Check that Firebase code is still in `MainApplication.kt` (don't remove it!)

### File not found?
- Check your Downloads folder
- File name must be exactly: `google-services.json` (lowercase, no spaces)
- Place it directly in `driver/android/app/` folder (not in a subfolder)

