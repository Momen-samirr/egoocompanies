# Production Environment Variables Setup

## Overview

This document explains how to configure production environment variables for the egoo driver app.

## Production URLs

Based on your Render deployment and DNS configuration:

- **API Server**: `https://api.egoobus.com/api/v1`
- **WebSocket Server**: `wss://ws.egoobus.com`
- **Google Maps API Key**: `AIzaSyACeuD1tWDY1_NO14iVNJMLM4mxM8sTn_Q`

## Configuration Methods

### Method 1: EAS Build Configuration (Recommended)

The production environment variables are already configured in `eas.json`:

```json
"production": {
  "env": {
    "EXPO_PUBLIC_SERVER_URI": "https://api.egoobus.com/api/v1",
    "EXPO_PUBLIC_WEBSOCKET_URL": "wss://ws.egoobus.com",
    "EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY": "AIzaSyACeuD1tWDY1_NO14iVNJMLM4mxM8sTn_Q"
  }
}
```

When you run `eas build --platform android --profile production`, these variables will be automatically included.

### Method 2: EAS Secrets (Alternative)

You can also use EAS secrets for more secure management:

```bash
# Set production secrets
eas secret:create --scope project --name EXPO_PUBLIC_SERVER_URI --value https://api.egoobus.com/api/v1 --type string
eas secret:create --scope project --name EXPO_PUBLIC_WEBSOCKET_URL --value wss://ws.egoobus.com --type string
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY --value AIzaSyACeuD1tWDY1_NO14iVNJMLM4mxM8sTn_Q --type string
```

Then reference them in `eas.json`:

```json
"production": {
  "env": {
    "EXPO_PUBLIC_SERVER_URI": "@EXPO_PUBLIC_SERVER_URI",
    "EXPO_PUBLIC_WEBSOCKET_URL": "@EXPO_PUBLIC_WEBSOCKET_URL",
    "EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY": "@EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY"
  }
}
```

### Method 3: Local .env File (For Local Testing)

For local development, create a `.env` file in the `driver/` directory:

```env
EXPO_PUBLIC_SERVER_URI=https://api.egoobus.com/api/v1
EXPO_PUBLIC_WEBSOCKET_URL=wss://ws.egoobus.com
EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY=AIzaSyACeuD1tWDY1_NO14iVNJMLM4mxM8sTn_Q
```

**Note**: `.env` files are gitignored, so they won't be committed to the repository.

## Verification

After building, verify the environment variables are set correctly by checking the app logs:

1. Build the app: `eas build --platform android --profile production`
2. Install on a device
3. Check console logs for:
   ```
   Environment check: { 
     hasEnvVar: true, 
     envUriValue: 'https://api.egoobus.com/api/v1',
     ...
   }
   ```

## Important Notes

1. **HTTPS/WSS Required**: Production uses `https://` and `wss://` (secure protocols) - required by Google Play Store
2. **DNS Configuration**: Ensure your DNS records are properly configured:
   - `api.egoobus.com` → `egoo-api.onrender.com`
   - `ws.egoobus.com` → `egoo-socket.onrender.com`
3. **SSL Certificates**: Render automatically provides SSL certificates for HTTPS/WSS
4. **Testing**: Test the production URLs before building:
   - API: `https://api.egoobus.com/api/v1/driver/send-otp` (should return an error, but confirms server is reachable)
   - WebSocket: Connect to `wss://ws.egoobus.com` from a WebSocket client

## Current Configuration

✅ Production environment variables are configured in `eas.json`
✅ Using HTTPS/WSS for secure connections
✅ DNS records are set up correctly

## Next Steps

1. Verify Render services are running and accessible
2. Test production URLs from a browser/WebSocket client
3. Build production app: `eas build --platform android --profile production`
4. Test the production build on a device before submitting to Google Play

