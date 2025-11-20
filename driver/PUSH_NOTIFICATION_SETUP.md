# Push Notification Setup and Verification Guide

## ✅ Verification Checklist

### 1. Push Token is Valid and Recently Generated ✅
- **Location**: `driver/screens/home/home.screen.tsx`
- **Implementation**:
  - Token is generated on app launch
  - Token is refreshed when app comes to foreground (AppState listener)
  - Token is validated for correct format (`ExponentPushToken[...]`)
  - Token is saved to database with retry logic (10 attempts)
  - Token verification confirms database matches device token

### 2. Expo Push Endpoint is Correct ✅
- **Location**: `user/screens/rideplan/rideplan.screen.tsx`
- **Endpoint**: `https://exp.host/--/api/v2/push/send`
- **Verification**: 
  - ✅ Endpoint is correct (official Expo Push API)
  - ✅ Headers include proper Content-Type and Accept
  - ✅ Timeout set to 30 seconds
  - ✅ Response validation checks for `status: "ok"`

### 3. Firebase and expo-notifications Configuration ✅
- **Location**: `driver/app.json`, `driver/android/`
- **Configuration**:
  - ✅ `expo-notifications` plugin configured in `app.json`
  - ✅ Firebase metadata in `AndroidManifest.xml`
  - ✅ Notification icons and colors configured
  - ⚠️ **Note**: Expo's `expo-notifications` plugin automatically handles Firebase configuration
  - ⚠️ **Important**: App must be rebuilt after adding the plugin

## 🔧 Setup Instructions

### Step 1: Rebuild the App (REQUIRED)
After adding `expo-notifications` plugin, the app MUST be rebuilt:

```bash
cd driver
npx expo prebuild --clean
npx expo run:android
```

This ensures:
- Firebase is properly configured by Expo's plugin
- Native code includes notification support
- Push tokens can be generated correctly

### Step 2: Verify Token Generation
When the driver app starts, check logs for:
- `🔔 ===== STARTING PUSH NOTIFICATION REGISTRATION =====`
- `✅ ===== PUSH TOKEN OBTAINED SUCCESSFULLY =====`
- `✅ Token: ExponentPushToken[...]`
- `✅ Token verification: MATCH - notifications should work!`

### Step 3: Verify Token is Saved
Check logs for:
- `✅ ===== NOTIFICATION TOKEN SAVED SUCCESSFULLY =====`
- `✅ Token in database: ExponentPushToken[...]`
- `✅ Token verification: MATCH`

### Step 4: Test Notification Sending
1. Open user app
2. Select destination and driver
3. Click "Confirm Booking"
4. Check logs for:
   - `📤 ===== SENDING PUSH NOTIFICATION =====`
   - `📤 Endpoint: https://exp.host/--/api/v2/push/send`
   - `✅ Expo confirmed notification will be delivered`
   - `✅ Notification ID: ...`

### Step 5: Verify Notification Reception
Check driver app logs for:
- `🔔 ===== NOTIFICATION HANDLER CALLED =====`
- `📱 ===== NOTIFICATION RECEIVED - LISTENER FIRED =====`
- `📦 STEP 1-7: Data extraction logs`
- `🎯 STEP 9: Setting modal visible to true`
- Modal should appear on screen

## 🔍 Troubleshooting

### Issue: Token not saved to database
**Symptoms**: `⚠️ Driver notification token not available`
**Solution**:
1. Check driver app logs for token generation
2. Verify driver is logged in (has accessToken)
3. Check network connection
4. Verify server endpoint is accessible
5. Check server logs for errors

### Issue: Notification not received
**Symptoms**: Notification sent successfully but driver app doesn't receive it
**Possible Causes**:
1. **Token mismatch**: Device token doesn't match database token
   - **Solution**: Restart driver app to regenerate and save token
2. **App not running**: Driver app is closed
   - **Solution**: Driver app must be running or in background
3. **Network issues**: Device not connected to internet
   - **Solution**: Check device internet connection
4. **Notification permissions**: Permissions not granted
   - **Solution**: Check device notification settings
5. **Firebase not initialized**: App needs rebuild
   - **Solution**: Rebuild app with `npx expo prebuild --clean && npx expo run:android`

### Issue: Firebase initialization error
**Symptoms**: `Error: Default FirebaseApp is not initialized`
**Solution**:
1. **Rebuild app**: `npx expo prebuild --clean && npx expo run:android`
2. Verify `expo-notifications` plugin is in `app.json`
3. Check that app is using development build (not Expo Go)
4. **If error persists**, you may need to add `google-services.json`:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project (or create one)
   - Go to Project Settings → General
   - Under "Your apps", add Android app with package name: `com.becodemy.ridewavedriver`
   - Download `google-services.json`
   - Place it in `driver/android/app/` directory
   - Rebuild the app
5. Verify Firebase initialization code is in `MainApplication.kt` (should be added automatically)

## 📋 Current Configuration Status

### Driver App (`driver/app.json`)
- ✅ `expo-notifications` plugin: Configured
- ✅ `expo-dev-client` plugin: Configured
- ✅ EAS Project ID: `6cdffa57-e0c7-4571-bbe8-7b3c97422bc2`
- ✅ Package: `com.becodemy.ridewavedriver`

### Android Manifest (`driver/android/app/src/main/AndroidManifest.xml`)
- ✅ Firebase metadata: Configured
- ✅ Notification icons: Configured
- ✅ Notification colors: Configured
- ✅ Permissions: INTERNET, VIBRATE

### Native Code (`driver/android/app/src/main/java/com/becodemy/ridewavedriver/MainApplication.kt`)
- ✅ Expo modules: Configured
- ✅ Firebase initialization: Manually added to ensure Firebase is initialized on app start
- ✅ Firebase import: `com.google.firebase.FirebaseApp` added

### Build Configuration (`driver/android/build.gradle`)
- ✅ Google repositories: Configured
- ✅ Google Services plugin: Added to project-level `build.gradle` (classpath)
- ✅ Google Services plugin: Applied to app-level `build.gradle`
- ✅ Firebase BOM: Added (version 32.7.0)
- ✅ Firebase Messaging: Added for push notifications
- ⚠️ **Note**: `google-services.json` file may be needed - see troubleshooting section

## 🚀 Next Steps

1. **Rebuild the driver app**:
   ```bash
   cd driver
   npx expo prebuild --clean
   npx expo run:android
   ```

2. **Test token generation**:
   - Open driver app
   - Log in as driver
   - Check logs for token generation and saving

3. **Test notification sending**:
   - Open user app
   - Select destination and driver
   - Click "Confirm Booking"
   - Check logs for notification sending

4. **Verify notification reception**:
   - Check driver app logs for notification handler
   - Verify modal appears on screen

## 📝 Important Notes

1. **Expo handles Firebase automatically**: The `expo-notifications` plugin automatically configures Firebase. No manual `google-services.json` or Firebase initialization needed.

2. **App must be rebuilt**: After adding `expo-notifications` plugin, the app MUST be rebuilt. Simply reloading won't work.

3. **Development build required**: Push notifications require a development build (not Expo Go) because they use native modules.

4. **Token refresh**: Token is automatically refreshed when app comes to foreground to ensure it's always valid.

5. **Token validation**: Token format is validated before sending to ensure it's correct.

6. **Endpoint verification**: The Expo push endpoint is verified and correct: `https://exp.host/--/api/v2/push/send`

## 🔗 Resources

- [Expo Push Notifications Documentation](https://docs.expo.dev/push-notifications/overview/)
- [Expo Notifications Plugin Configuration](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Firebase Configuration with Expo](https://docs.expo.dev/push-notifications/push-notifications-setup/)

