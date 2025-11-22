# Dashboard Setup Guide

## Quick Setup for Local Development

### 1. Create Environment File

Create a `.env.local` file in the `dashboard` directory with the following content:

```env
# API Configuration - Your backend server
NEXT_PUBLIC_API_URL=http://192.168.1.7:8000/api/v1

# Google Maps API Key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyACeuD1tWDY1_NO14iVNJMLM4mxM8sTn_Q

# WebSocket Server URL
NEXT_PUBLIC_WEBSOCKET_URL=ws://192.168.1.7:8080
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

The dashboard will be available at `http://localhost:3000`

## Environment Variables Explained

### NEXT_PUBLIC_API_URL
- **Local Development**: `http://192.168.1.7:8000/api/v1` (your local server)
- **Production**: `https://your-api-domain.com/api/v1`
- This is where the dashboard sends API requests to interact with your backend server

### NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
- Your Google Maps API key for displaying maps
- Required for the Live Map feature
- Get your key from: https://console.cloud.google.com/google/maps-apis

### NEXT_PUBLIC_WEBSOCKET_URL
- **Local Development**: `ws://192.168.1.7:8080` (your local WebSocket server)
- **Production**: `wss://your-websocket-server.com` (use `wss://` for secure connections)
- Required for real-time driver location updates on the map

## Testing Server Connection

After starting the dashboard, check the browser console:
- ✅ You should see: `🔗 API URL configured: http://192.168.1.7:8000/api/v1`
- ✅ If connected: No network errors
- ❌ If not connected: Check that your backend server is running on port 8000

## Troubleshooting

### Cannot Connect to Server

1. **Check if backend server is running:**
   ```bash
   cd ../server
   npm run dev
   ```

2. **Verify the IP address:**
   - Make sure `192.168.1.7` is the correct IP of your server machine
   - You can find your IP with: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)

3. **Check firewall settings:**
   - Ensure port 8000 is accessible
   - Ensure port 8080 (WebSocket) is accessible

### Map Not Loading

1. **Verify Google Maps API Key:**
   - Check the key is correct in `.env.local`
   - Ensure Maps JavaScript API is enabled in Google Cloud Console

2. **Check browser console for errors**

### WebSocket Not Connecting

1. **Verify WebSocket server is running:**
   ```bash
   cd ../socket
   node server.js
   ```

2. **Check the URL format:**
   - Use `ws://` for local development
   - Use `wss://` for production (secure WebSocket)

## Next Steps

1. ✅ Create `.env.local` with your configuration
2. ✅ Install dependencies: `npm install`
3. ✅ Start development server: `npm run dev`
4. ✅ Login with admin credentials
5. ✅ Test API connection by viewing dashboard stats
6. ✅ Test WebSocket connection by viewing the Live Map

## Production Deployment

See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for deploying to Vercel.

