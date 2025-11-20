# FCM v1 Setup with Expo - Service Account Key

## ✅ Good News!

Expo **DOES support FCM v1** now! You need to use a **Service Account JSON key** instead of the old Server Key.

## Step-by-Step Setup

### Step 1: Generate Service Account Key from Firebase

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select your project** (the same one with your Android app)
3. **Go to Project Settings**:
   - Click the gear icon (⚙️) next to "Project Overview"
   - Select "Project settings"
4. **Go to Service Accounts tab**:
   - Click on the "Service accounts" tab at the top
5. **Generate Private Key**:
   - Click "Generate new private key" button
   - A dialog will appear warning about keeping it secure
   - Click "Generate key"
   - A JSON file will be downloaded (e.g., `your-project-firebase-adminsdk-xxxxx.json`)
   - **Save this file securely** - you'll need it in the next step

### Step 2: Upload Service Account Key to Expo

You have two options:

#### Option A: Using EAS CLI (Recommended)

1. **Install EAS CLI** (if not already installed):
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo**:
   ```bash
   eas login
   ```

3. **Navigate to your project**:
   ```bash
   cd driver
   ```

4. **Configure credentials**:
   ```bash
   eas credentials
   ```
   
   Then follow the prompts:
   - Select **Android**
   - Select **production** (or development, depending on your build)
   - Select **Google Service Account**
   - Choose **"Manage your Google Service Account Key for Push Notifications (FCM V1)"**
   - Select **"Upload a new service account key"**
   - Provide the path to the JSON file you downloaded (e.g., `./your-project-firebase-adminsdk-xxxxx.json`)

#### Option B: Using Expo Dashboard

1. **Go to Expo Dashboard**: https://expo.dev/
2. **Select your project**: `6cdffa57-e0c7-4571-bbe8-7b3c97422bc2`
3. **Go to Credentials**:
   - Click on "Credentials" in the left sidebar
   - Select "Android"
   - Find "Push Notifications" section
4. **Upload Service Account Key**:
   - Look for "Google Service Account Key (FCM V1)" option
   - Click "Upload" or "Add"
   - Upload the JSON file you downloaded
   - Save

### Step 3: Verify Configuration

After uploading the Service Account key:

1. **Wait 5-10 minutes** for Expo to process the credentials
2. **Test sending a push notification**
3. **Check the response** - you should see `"status": "ok"` instead of the error

## Important Notes

- ✅ **Service Account Key replaces Server Key**: The old `AAAA...` server key is no longer needed
- ✅ **FCM v1 is the new standard**: This is the correct, future-proof approach
- ✅ **Same Firebase project**: Use the same project for both `google-services.json` and Service Account key
- ✅ **JSON file format**: The Service Account key is a JSON file, not a string like the old server key
- ✅ **Keep it secure**: Don't commit the Service Account JSON file to git - it contains sensitive credentials

## Verification

After setup, test your push notifications. You should see:
- ✅ No "FCM server key" errors
- ✅ `"status": "ok"` in Expo's response
- ✅ Notifications successfully delivered to devices

## Troubleshooting

### Can't find "Service accounts" tab?
- Make sure you're in the correct Firebase project
- The tab should be in Project Settings → Service accounts

### EAS CLI not working?
- Make sure you're logged in: `eas login`
- Make sure your project is linked: `eas init` (if needed)
- Check Expo project ID matches: `6cdffa57-e0c7-4571-bbe8-7b3c97422bc2`

### Still getting errors?
1. Wait 5-10 minutes after uploading the key
2. Verify the JSON file is valid (should be proper JSON format)
3. Make sure you're using the same Firebase project
4. Check Expo dashboard to confirm the key was uploaded successfully

## Quick Reference

- **Firebase Console**: https://console.firebase.google.com/
- **Expo Dashboard**: https://expo.dev/
- **EAS CLI Command**: `eas credentials`
- **Service Account Location**: Firebase Console → Project Settings → Service Accounts
- **Expo Project ID**: `6cdffa57-e0c7-4571-bbe8-7b3c97422bc2`

