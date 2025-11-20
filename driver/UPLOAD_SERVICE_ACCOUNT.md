# Quick Guide: Uploading Service Account JSON to Expo

## Your File
- **File name**: `ridewave-driver-8395a-firebase-adminsdk-fbsvc-be6444eb69.json`
- **Location**: Wherever you downloaded it (likely Downloads folder)

## Two Options

### Option 1: Upload from Current Location (Easiest)

You can upload the file directly from wherever it is (Downloads, Desktop, etc.):

```bash
cd driver
eas credentials
```

When prompted for the file path, provide the **full path**:
```
/home/momen-samir/Downloads/ridewave-driver-8395a-firebase-adminsdk-fbsvc-be6444eb69.json
```

Or if it's in a different location, use that path instead.

### Option 2: Move to Project Root (Optional)

If you prefer to have it in the project temporarily:

```bash
# Move the file to driver folder
mv ~/Downloads/ridewave-driver-8395a-firebase-adminsdk-fbsvc-be6444eb69.json driver/

# Then upload
cd driver
eas credentials
# When asked for path, use: ./ridewave-driver-8395a-firebase-adminsdk-fbsvc-be6444eb69.json
```

**Note**: The file is already added to `.gitignore`, so it won't be committed to git.

## Step-by-Step Upload Process

1. **Make sure EAS CLI is installed and you're logged in**:
   ```bash
   npm install -g eas-cli
   eas login
   ```

2. **Navigate to driver folder**:
   ```bash
   cd driver
   ```

3. **Run credentials command**:
   ```bash
   eas credentials
   ```

4. **Follow the prompts**:
   - Select **Android**
   - Select **production** (or development if testing)
   - Select **Google Service Account**
   - Choose **"Manage your Google Service Account Key for Push Notifications (FCM V1)"**
   - Select **"Upload a new service account key"**
   - **Provide the file path**:
     - If in Downloads: `/home/momen-samir/Downloads/ridewave-driver-8395a-firebase-adminsdk-fbsvc-be6444eb69.json`
     - If in project root: `./ridewave-driver-8395a-firebase-adminsdk-fbsvc-be6444eb69.json`
     - Or use the full absolute path wherever it is

5. **Wait for confirmation** - Expo will upload and configure the key

6. **Wait 5-10 minutes** for changes to propagate

7. **Test push notifications** - they should work now!

## Important Notes

- ✅ **You don't need to keep the file in the project** - Expo stores it securely
- ✅ **The file is in .gitignore** - won't be committed to git
- ✅ **You can delete the local file** after uploading (Expo keeps it)
- ✅ **Use full path** if uploading from Downloads or other location

## After Upload

Once uploaded successfully:
- ✅ You can delete the local JSON file (Expo has it stored)
- ✅ Wait 5-10 minutes for changes to take effect
- ✅ Test your push notifications
- ✅ You should see `"status": "ok"` instead of the FCM error

## Troubleshooting

**File not found?**
- Check the exact path: `ls -la ~/Downloads/ridewave-driver-8395a-firebase-adminsdk-fbsvc-be6444eb69.json`
- Use absolute path: `/home/momen-samir/Downloads/ridewave-driver-8395a-firebase-adminsdk-fbsvc-be6444eb69.json`

**EAS CLI not working?**
- Make sure you're logged in: `eas login`
- Make sure you're in the driver folder: `cd driver`
- Check project is linked: `eas init` (if needed)

