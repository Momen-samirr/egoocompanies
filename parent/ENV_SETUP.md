# Environment Variables Setup Guide for Parent App

## Overview
The Parent app uses environment variables to configure API endpoints, WebSocket connections, and API keys. These can be set via `.env` file for local development or via EAS Build configuration for production builds.

## Local Development Setup

### 1. Create `.env` file

Create a `.env` file in the `parent/` directory (same level as `package.json`) with the following format:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.2:8000/api/v1
EXPO_PUBLIC_WEBSOCKET_URL=ws://192.168.1.2:8080
EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY=AIzaSyACeuD1tWDY1_NO14iVNJMLM4mxM8sTn_Q
```

### 2. Important Notes:

- **NO spaces around the `=` sign**
- **NO quotes around the values** (unless the value itself needs quotes)
- **Use `http://` not `http:`** - the URL must have `//` after the scheme
- **For physical devices**: Use your computer's local IP address (e.g., `192.168.1.2`) instead of `localhost`
- **For emulators/simulators**: 
  - Android emulator: Use `10.0.2.2` (maps to host's localhost)
  - iOS simulator: Use `localhost` or `127.0.0.1`

### 3. Restart Expo Dev Server

After creating/editing the `.env` file, you **MUST** restart the Expo dev server:

1. Stop the current server (Ctrl+C)
2. Clear cache: `npx expo start --clear`
3. Or restart normally: `npx expo start`

### 4. Verify Environment Variables

After restarting, check the console logs. You should see:
```
[DEBUG] API configuration initialized: { apiUrl: 'http://...', platform: 'android', envUrl: 'http://...' }
```

## Production Build Setup

For production builds via EAS Build, environment variables are configured in `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.egoobus.com/api/v1",
        "EXPO_PUBLIC_WEBSOCKET_URL": "wss://ws.egoobus.com",
        "EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}
```

### Using EAS Secrets (Recommended)

Instead of hardcoding values in `eas.json`, you can use EAS Secrets:

```bash
# Set secrets for production builds
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://api.egoobus.com/api/v1"
eas secret:create --scope project --name EXPO_PUBLIC_WEBSOCKET_URL --value "wss://ws.egoobus.com"
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY --value "YOUR_API_KEY"
```

Then reference them in `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "@expo-secret:EXPO_PUBLIC_API_URL",
        "EXPO_PUBLIC_WEBSOCKET_URL": "@expo-secret:EXPO_PUBLIC_WEBSOCKET_URL",
        "EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY": "@expo-secret:EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY"
      }
    }
  }
}
```

## Common Mistakes to Avoid:

❌ **WRONG:**
```env
EXPO_PUBLIC_API_URL = "http:192.168.1.2:8000/api/v1"
EXPO_PUBLIC_API_URL=http:192.168.1.2:8000/api/v1
EXPO_PUBLIC_API_URL="http://192.168.1.2:8000/api/v1"
```

✅ **CORRECT:**
```env
EXPO_PUBLIC_API_URL=http://192.168.1.2:8000/api/v1
```

## Finding Your Local IP Address

**On Linux/Mac:**
```bash
ip addr show | grep "inet " | grep -v 127.0.0.1
# or
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**On Windows:**
```bash
ipconfig
# Look for IPv4 Address under your network adapter
```

## Network Requirements

- Your device and computer must be on the **same WiFi network**
- Firewall must allow connections on ports 8000 (API) and 8080 (WebSocket)
- Server must be bound to `0.0.0.0` (not just `localhost`) to accept external connections

## Environment Variables Reference

| Variable | Description | Example (Local) | Example (Production) |
|----------|-------------|-----------------|---------------------|
| `EXPO_PUBLIC_API_URL` | Backend API endpoint | `http://192.168.1.2:8000/api/v1` | `https://api.egoobus.com/api/v1` |
| `EXPO_PUBLIC_WEBSOCKET_URL` | WebSocket server URL | `ws://192.168.1.2:8080` | `wss://ws.egoobus.com` |
| `EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY` | Google Maps API key | `AIzaSy...` | `AIzaSy...` |

## Troubleshooting

### Environment variables not loading
1. Ensure `.env` file is in the `parent/` directory (same level as `package.json`)
2. Restart Expo dev server with `--clear` flag
3. Check that variable names start with `EXPO_PUBLIC_`
4. Verify no spaces around `=` sign

### Network errors
1. Verify server is running and accessible
2. Check firewall settings
3. Ensure device and computer are on same network
4. Test API URL in browser on device/emulator

