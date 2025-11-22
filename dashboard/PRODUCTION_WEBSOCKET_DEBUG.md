# Production WebSocket Debugging Guide

## Issue: Drivers Not Showing on Dashboard After Vercel Deployment

### Problem
- Dashboard works on localhost but shows "Connected Drivers: 0 / 0 total" on production
- Dashboard connects to WebSocket successfully (green indicator)
- But no drivers are being received

## Root Cause Analysis

The issue is likely one of these:

1. **Drivers connecting to wrong WebSocket server**
   - Driver app might still be using localhost WebSocket URL
   - Need to verify `EXPO_PUBLIC_WEBSOCKET_URL` is set to `wss://ws.egoobus.com` in production build

2. **WebSocket server not receiving driver connections**
   - Origin verification might be blocking (but we allow no origin for mobile apps)
   - Check WebSocket server logs for connection attempts

3. **Driver location updates not being sent**
   - Driver must be "active" (isOn = true) to send location updates
   - Check driver app logs

## Debugging Steps

### 1. Check WebSocket Server Logs

Look for these log messages:

```
🔍 WebSocket connection attempt from origin: ...
👤 Admin client connected
📊 Current drivers in system: X
📤 Sending initial driver locations (X drivers) to admin client
```

If you see:
- `👤 Admin client connected` but `📊 Current drivers in system: 0` → No drivers are connected
- No `👤 Admin client connected` → Dashboard connection is being rejected

### 2. Test WebSocket Server Stats Endpoint

Visit: `https://ws.egoobus.com/api/stats`

This will show:
```json
{
  "connections": {
    "total": 2,
    "admin": 1,
    "drivers": 1
  },
  "drivers": {
    "count": 1,
    "ids": ["driver-id-here"]
  },
  "activeRides": {
    "count": 0
  }
}
```

**If `connections.drivers` is 0:**
- Drivers are not connecting to the WebSocket server
- Check driver app configuration

**If `drivers.count` is 0 but `connections.drivers` > 0:**
- Drivers are connected but not sending location updates
- Check driver app logs

### 3. Check Driver App Configuration

Verify the driver app has:
- `EXPO_PUBLIC_WEBSOCKET_URL=wss://ws.egoobus.com` in production build
- Driver is "active" (toggle is ON)
- Driver app is sending location updates

### 4. Test Dashboard Connection

In browser console on `https://dashapp.egoobus.com/dashboard/map`:

```javascript
// Check WebSocket connection
console.log('WebSocket URL:', process.env.NEXT_PUBLIC_WEBSOCKET_URL);

// Manually test WebSocket
const ws = new WebSocket('wss://ws.egoobus.com?role=admin');
ws.onopen = () => console.log('✅ Connected');
ws.onmessage = (e) => {
  const data = JSON.parse(e.data);
  console.log('📨 Message:', data);
  if (data.type === 'driverLocations') {
    console.log('📍 Drivers:', Object.keys(data.drivers || {}).length);
  }
};
ws.onerror = (e) => console.error('❌ Error:', e);
ws.onclose = (e) => console.log('🔌 Closed:', e.code, e.reason);
```

### 5. Check Vercel Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables:

- `NEXT_PUBLIC_WEBSOCKET_URL` should be `wss://ws.egoobus.com`
- No trailing slash
- Must use `wss://` (not `ws://`)

### 6. Test HTTP API Fallback

Visit: `https://ws.egoobus.com/api/drivers`

This should return:
```json
{
  "drivers": {
    "driver-id": {
      "id": "driver-id",
      "latitude": 23.8103,
      "longitude": 90.4125,
      "name": "Driver Name",
      "status": "active",
      "vehicleType": "Car",
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  },
  "count": 1,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

If this returns drivers but dashboard doesn't show them:
- Issue is with WebSocket message delivery
- Check browser console for WebSocket messages

## Common Issues and Solutions

### Issue 1: Drivers Not Connecting

**Symptoms:**
- `/api/stats` shows `connections.drivers: 0`
- WebSocket server logs show no driver connections

**Solution:**
1. Verify driver app `EXPO_PUBLIC_WEBSOCKET_URL` is set to `wss://ws.egoobus.com`
2. Rebuild and redeploy driver app with correct environment variable
3. Check driver app logs for WebSocket connection errors

### Issue 2: Drivers Connected But Not Sending Updates

**Symptoms:**
- `/api/stats` shows `connections.drivers > 0` but `drivers.count: 0`
- WebSocket server logs show driver connections but no location updates

**Solution:**
1. Check driver is "active" (toggle ON in driver app)
2. Check driver app logs for location update sending
3. Verify driver has location permissions enabled

### Issue 3: Dashboard Not Receiving Updates

**Symptoms:**
- `/api/drivers` shows drivers exist
- Dashboard shows "Connected" but 0 drivers
- Browser console shows no WebSocket messages

**Solution:**
1. Check browser console for WebSocket connection errors
2. Verify `NEXT_PUBLIC_WEBSOCKET_URL` in Vercel is correct
3. Check WebSocket server logs for admin client connection
4. Test manual WebSocket connection in browser console

### Issue 4: Origin Verification Blocking

**Symptoms:**
- WebSocket server logs show "❌ WebSocket connection rejected from origin"
- Dashboard cannot connect

**Solution:**
1. Check actual origin in WebSocket server logs
2. Update `allowedWebSocketOrigins` in `socket/server.js` if needed
3. The code currently allows connections for debugging - check logs

## Quick Fix Checklist

- [ ] WebSocket server is running and accessible
- [ ] `NEXT_PUBLIC_WEBSOCKET_URL=wss://ws.egoobus.com` in Vercel
- [ ] Driver app has `EXPO_PUBLIC_WEBSOCKET_URL=wss://ws.egoobus.com` in production
- [ ] Driver app is rebuilt with production environment variables
- [ ] Driver is "active" in driver app
- [ ] WebSocket server logs show driver connections
- [ ] `/api/stats` shows drivers connected
- [ ] Dashboard browser console shows WebSocket messages

## Testing Commands

### Test WebSocket Server
```bash
# Check if server is running
curl https://ws.egoobus.com/api/stats

# Get driver list
curl https://ws.egoobus.com/api/drivers
```

### Test Dashboard Connection
```javascript
// In browser console on dashboard
fetch('https://ws.egoobus.com/api/stats')
  .then(r => r.json())
  .then(console.log);
```

## Next Steps

1. Deploy updated WebSocket server with enhanced logging
2. Check WebSocket server logs for connection attempts
3. Verify driver app is using production WebSocket URL
4. Test using the `/api/stats` endpoint
5. Check browser console on dashboard for WebSocket messages

