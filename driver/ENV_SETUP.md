# Environment Variables Setup Guide

## Issue
The app is showing "Network Error" because the environment variables are not being loaded correctly.

## Solution

### 1. Create/Edit `.env` file

Create a `.env` file in the `driver/` directory (same level as `package.json`) with the following format:

```env
EXPO_PUBLIC_SERVER_URI=http://192.168.1.2:8000/api/v1
EXPO_PUBLIC_GOOGLE_CLOUD_API_KEY=AIzaSyACeuD1tWDY1_NO14iVNJMLM4mxM8sTn_Q
EXPO_PUBLIC_WEBSOCKET_URL=ws://192.168.1.2:8080
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
Environment check: { hasEnvVar: true, envUriValue: 'http://192.168.1.2:8000/api/v1', ... }
Server URI - Original: http://192.168.1.2:8000/api/v1 Cleaned: http://192.168.1.2:8000/api/v1
```

### 5. Common Mistakes to Avoid:

❌ **WRONG:**
```env
EXPO_PUBLIC_SERVER_URI = "http:192.168.1.2:8000/api/v1"
EXPO_PUBLIC_SERVER_URI=http:192.168.1.2:8000/api/v1
EXPO_PUBLIC_SERVER_URI="http://192.168.1.2:8000/api/v1"
```

✅ **CORRECT:**
```env
EXPO_PUBLIC_SERVER_URI=http://192.168.1.2:8000/api/v1
```

### 6. Finding Your Local IP Address

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

### 7. Make Sure Server is Running

Ensure your backend server is running on port 8000 and accessible from your device/emulator.

**Test the server URL:**
- Open a browser on your device/emulator
- Navigate to: `http://192.168.1.2:8000/api/v1/driver/send-otp` (should return an error, but confirms server is reachable)

### 8. Network Requirements

- Your device and computer must be on the **same WiFi network**
- Firewall must allow connections on port 8000
- Server must be bound to `0.0.0.0` (not just `localhost`) to accept external connections

