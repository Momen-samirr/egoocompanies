# FCM Server Key Setup for Expo Push Notifications

## The Problem
You're getting this error:
```
"Unable to retrieve the FCM server key for the recipient's app. 
Make sure you have provided a server key as directed by the Expo FCM documentation."
```

This happens because Expo needs your Firebase Cloud Messaging (FCM) server key to send push notifications.

## Solution: Configure FCM Server Key with Expo

### Step 1: Get FCM Server Key from Firebase Console

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select your project** (the same one where you added the Android app)
3. **Go to Project Settings**:
   - Click the gear icon (⚙️) next to "Project Overview"
   - Select "Project settings"
4. **Go to Cloud Messaging tab**:
   - Click on the "Cloud Messaging" tab at the top
5. **Copy the Server Key**:
   - Look for "Cloud Messaging API (Legacy)" section
   - Find "Server key" - it's a long string starting with something like `AAAA...`
   - Click the copy icon or select and copy the entire key
   - **Note**: If you don't see "Server key", you may need to enable "Cloud Messaging API (Legacy)" first

### Step 2: Configure FCM Server Key with Expo

You need to add the FCM server key to your Expo project using EAS credentials.

#### Option A: Using EAS CLI (Recommended)

1. **Install EAS CLI** (if not already installed):
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo**:
   ```bash
   eas login
   ```

3. **Link your project** (if not already linked):
   ```bash
   cd driver
   eas init
   ```

4. **Add FCM Server Key as a credential**:
   ```bash
   eas credentials
   ```
   
   Then:
   - Select your project
   - Select "Android"
   - Select "Push Notifications"
   - Choose "Add new FCM Server Key"
   - Paste your FCM server key
   - Save

#### Option B: Using Expo Dashboard

1. **Go to Expo Dashboard**: https://expo.dev/
2. **Select your project**: `6cdffa57-e0c7-4571-bbe8-7b3c97422bc2`
3. **Go to Credentials**:
   - Click on "Credentials" in the left sidebar
   - Select "Android"
   - Find "Push Notifications" section
4. **Add FCM Server Key**:
   - Click "Add FCM Server Key" or "Edit"
   - Paste your FCM server key
   - Click "Save"

### Step 3: Verify Configuration

After adding the FCM server key:

1. **Wait a few minutes** for Expo to process the credentials
2. **Try sending a push notification again**
3. **Check the response** - you should see `"status": "ok"` instead of the error

## Important Notes

- **FCM Server Key vs API Key**: The FCM server key is different from your Google Maps API key
- **Legacy API**: You may need to enable "Cloud Messaging API (Legacy)" in Firebase Console
- **Project ID**: Make sure you're using the same Firebase project for both:
  - The `google-services.json` file
  - The FCM server key
- **EAS Project ID**: Your Expo project ID is `6cdffa57-e0c7-4571-bbe8-7b3c97422bc2` - make sure this matches

## Troubleshooting

### Can't find Server Key in Firebase Console?
1. Make sure you're in the correct Firebase project
2. Go to Project Settings → Cloud Messaging tab
3. If you see "Cloud Messaging API (V1)" but not "Legacy", you may need to:
   - Enable the Legacy API in Google Cloud Console
   - Or use the new API (requires different setup)

### Still getting errors after adding the key?
1. Wait 5-10 minutes for changes to propagate
2. Verify the key was copied correctly (no extra spaces)
3. Make sure you're using the same Firebase project
4. Check that your Expo project ID matches: `6cdffa57-e0c7-4571-bbe8-7b3c97422bc2`

## Quick Reference

- **Firebase Console**: https://console.firebase.google.com/
- **Expo Dashboard**: https://expo.dev/
- **Project Settings → Cloud Messaging**: Where to find the server key
- **EAS CLI Command**: `eas credentials`
- **Expo Project ID**: `6cdffa57-e0c7-4571-bbe8-7b3c97422bc2`

