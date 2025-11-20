# FCM v1 Migration Guide - Expo Push Notifications

## The Situation

✅ **You're correct**: Google has deprecated the Legacy FCM API (Server Key starting with `AAAA...`)

❌ **Current Issue**: Expo's push notification service still uses the Legacy FCM API

⚠️ **The Problem**: Expo hasn't fully migrated to FCM v1 yet, so we need a workaround

## Solution Options

### Option 1: Enable Legacy API (Temporary Workaround)

Even though it's deprecated, Google may still allow you to enable it temporarily:

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Select your Firebase project**
3. **Navigate to APIs & Services → Library**
4. **Search for**: "Firebase Cloud Messaging API"
5. **Enable BOTH**:
   - ✅ "Firebase Cloud Messaging API" (new v1)
   - ✅ "Firebase Cloud Messaging API (Legacy)" (if available)
6. **Go back to Firebase Console**:
   - Project Settings → Cloud Messaging tab
   - Check if "Server key" appears under "Cloud Messaging API (Legacy)"

**Note**: If the Legacy API option is completely gone, this won't work.

### Option 2: Use Expo's Push Service Directly (Recommended)

Instead of relying on FCM server key, you can send notifications directly through Expo's push service. The current code already does this, but we need to ensure it's configured correctly.

**Current Setup**: Your code sends to `https://exp.host/--/api/v2/push/send` which should work without FCM server key for basic notifications.

**The Error**: The error suggests Expo is trying to use FCM for Android delivery, which requires the server key.

### Option 3: Wait for Expo to Support FCM v1

Expo is working on FCM v1 support, but it's not fully available yet. You can:
- Check Expo's GitHub for updates: https://github.com/expo/expo
- Monitor Expo's documentation: https://docs.expo.dev/push-notifications/overview/

### Option 4: Send Notifications Directly via FCM v1 (Advanced)

If you want to bypass Expo's push service and send directly via FCM v1:

1. **Get Service Account Key**:
   - Firebase Console → Project Settings → Service Accounts
   - Click "Generate new private key"
   - Download the JSON file

2. **Use FCM v1 API directly** in your server code (not through Expo)

This requires significant code changes and is more complex.

## Recommended Approach

### Step 1: Try to Enable Legacy API

1. Go to: https://console.cloud.google.com/apis/library
2. Search: "Firebase Cloud Messaging API (Legacy)"
3. If it appears, click "Enable"
4. Go back to Firebase Console → Project Settings → Cloud Messaging
5. Check if Server Key appears

### Step 2: If Legacy API is Not Available

**Contact Expo Support** or check their status:
- Expo Forum: https://forums.expo.dev/
- Expo Discord: https://chat.expo.dev/
- Ask about FCM v1 migration timeline

### Step 3: Temporary Workaround

For now, you can:
1. Continue using Expo's push service (which you're already doing)
2. The error might not prevent all notifications - test if notifications still arrive
3. Monitor Expo's updates for FCM v1 support

## Current Status Check

Run this to see what's available:
```bash
# Check if Legacy API can be enabled
# Go to: https://console.cloud.google.com/apis/library/googlecloudmessaging.googleapis.com
```

## Next Steps

1. ✅ Try to enable Legacy API (if still possible)
2. ✅ Test if notifications work despite the error
3. ✅ Monitor Expo's FCM v1 support
4. ✅ Consider alternative notification delivery methods if needed

## Important Notes

- **Legacy API is deprecated** but may still work until fully removed
- **FCM v1 is the future** but requires Service Account JSON keys
- **Expo needs to update** their service to support FCM v1
- **Your current code** should work once FCM credentials are properly configured

