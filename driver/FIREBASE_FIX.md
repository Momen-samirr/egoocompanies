# ✅ FIXED: google-services.json Being Deleted Issue

## The Problem
When you run `npx expo prebuild --clean`, it deletes the entire `android/` directory and regenerates it, which removes your `google-services.json` file.

## The Solution
Place `google-services.json` in the **project root** (not in `android/app/`) and reference it in `app.json`. Expo will automatically copy it to the correct location during prebuild.

## ✅ What I've Done

1. ✅ Updated `app.json` to reference `google-services.json` from root
2. ✅ Added Firebase initialization code back
3. ✅ Added Firebase dependencies and plugins

## 📋 What You Need to Do

### Step 1: Get google-services.json from Firebase Console

1. Go to: https://console.firebase.google.com/
2. Create or select your project
3. Add Android app:
   - Gear icon (⚙️) → Project settings
   - Scroll to "Your apps" section
   - Click Android icon (🤖)
   - **Package name**: `com.becodemy.ridewavedriver` (must match exactly!)
   - Click "Register app"
4. Download: Click "Download google-services.json"

### Step 2: Place File in Project Root

**IMPORTANT**: Place the file in the **root** of the `driver` folder, NOT in `android/app/`!

```
driver/
  google-services.json  ← Place it HERE (in root)
  app.json
  package.json
  android/
    app/
      (Expo will copy it here automatically)
```

**Full path**: `/home/momen-samir/Work/ecar (Copy)/driver/google-services.json`

### Step 3: Verify File Location

Run this command to check:
```bash
ls -la driver/google-services.json
```

You should see the file. If not, it's in the wrong location.

### Step 4: Rebuild (File Won't Be Deleted!)

Now you can safely run:
```bash
cd driver
npx expo prebuild --clean
npx expo run:android
```

The `google-services.json` file will **NOT be deleted** because it's in the root and referenced in `app.json`. Expo will automatically copy it to `android/app/` during prebuild.

## ✅ Verification

After rebuilding, check:
- ✅ File exists in `driver/android/app/google-services.json` (copied by Expo)
- ✅ No Firebase initialization errors in logs
- ✅ Push token generation works

## Why This Works

- `app.json` now has: `"googleServicesFile": "./google-services.json"`
- Expo reads this config and copies the file during prebuild
- The file in root is never deleted (only the `android/` folder is regenerated)
- Expo automatically places it in the correct location (`android/app/`)

## Important Notes

- **DO NOT** place the file in `android/app/` manually anymore
- **DO** place it in the project root (`driver/` folder)
- The file will be automatically copied to the right place during prebuild
- You can safely run `expo prebuild --clean` without losing the file

