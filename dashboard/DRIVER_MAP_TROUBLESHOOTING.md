# Driver Map Troubleshooting Guide

## Issue: Drivers Not Showing on Map

If drivers are online but not appearing on the dashboard map, follow these steps:

## 1. Check WebSocket Connection

### In Browser Console (Dashboard)
1. Open `https://dashapp.egoobus.com/dashboard/map`
2. Open browser DevTools (F12)
3. Check the Console tab for:
   - `✅ Connected to WebSocket server` - Connection successful
   - `📨 WebSocket message received: driverLocations` - Receiving driver data
   - `📍 Received X driver locations from WebSocket` - Driver count

### Check Connection Status
- Look for the connection indicator in the map controls (green = connected, red = disconnected)
- If disconnected, check the error message displayed

## 2. Check WebSocket Server Logs

### On Your WebSocket Server
Check the server logs for:

```
✅ WebSocket server ready on port 8080
🔍 WebSocket connection attempt from origin: https://dashapp.egoobus.com
✅ WebSocket connection allowed from origin: https://dashapp.egoobus.com
👤 Admin client connected
📊 Current drivers in system: X
📤 Sending initial driver locations (X drivers) to admin client
```

### If You See Connection Rejections
```
❌ WebSocket connection rejected from origin: ...
```
- Check the actual origin being sent
- Update `allowedWebSocketOrigins` in `socket/server.js` if needed

## 3. Verify Driver is Sending Location Updates

### Check Driver App
- Ensure the driver app is running and connected
- Driver should be sending location updates with `type: "locationUpdate"` and `role: "driver"`

### Check WebSocket Server Logs for Driver Updates
Look for:
```
✅ Updated driver location: ID=..., Status=active, Name=..., Lat=..., Lng=...
📊 Total drivers in system: X
📡 Broadcasting driver location update for driver ... to admin clients
📡 Broadcasted driverLocationUpdate to X/Y admin clients
```

## 4. Verify Driver Status

### Driver Must Be "active"
- Drivers with status "inactive" are filtered out
- Check the driver's status in the database or driver app
- Driver must send location updates with `status: "active"`

## 5. Check Map Filters

### In Dashboard Map Page
- Check the Status filter - ensure it's set to "All" or "Active"
- Check the Vehicle Type filter - ensure it matches the driver's vehicle
- Try clearing all filters to see all drivers

## 6. Browser Console Debugging

### Check Driver State
In browser console, run:
```javascript
// Check if drivers are in state
console.log('Drivers:', window.drivers); // Won't work directly, but check React DevTools

// Check WebSocket connection
// Look for WebSocket messages in Network tab
```

### Check for Errors
- Look for any red error messages in console
- Check Network tab → WS filter for WebSocket connection
- Verify WebSocket messages are being received

## 7. Verify Environment Variables

### In Vercel Dashboard
Ensure these are set correctly:
- `NEXT_PUBLIC_WEBSOCKET_URL=wss://ws.egoobus.com`
- `NEXT_PUBLIC_API_URL=https://api.egoobus.com/api/v1`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...`

### Verify WebSocket URL Format
- Must use `wss://` (not `ws://`) for production
- No trailing slash
- Full domain: `wss://ws.egoobus.com`

## 8. Test WebSocket Connection Manually

### In Browser Console
```javascript
const ws = new WebSocket('wss://ws.egoobus.com?role=admin');
ws.onopen = () => console.log('✅ Connected');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('📨 Message:', data);
  if (data.type === 'driverLocations') {
    console.log('📍 Drivers:', Object.keys(data.drivers || {}).length);
  }
};
ws.onerror = (error) => console.error('❌ Error:', error);
ws.onclose = (event) => console.log('🔌 Closed:', event.code, event.reason);
```

## 9. Common Issues and Solutions

### Issue: "WebSocket disconnected"
**Solution:**
- Check if WebSocket server is running
- Verify server is accessible from internet
- Check firewall/security group settings
- Verify DNS is pointing correctly

### Issue: "No drivers with location data"
**Solution:**
- Driver must send at least one location update
- Check driver app is running and connected
- Verify driver is sending updates with correct format
- Check WebSocket server logs for driver messages

### Issue: Drivers appear then disappear
**Solution:**
- Check driver status - if status changes to "inactive", driver is removed
- Check WebSocket connection stability
- Verify ping/pong keepalive is working

### Issue: Connection works but no drivers
**Solution:**
- Check if any drivers are actually online
- Verify drivers are sending location updates
- Check WebSocket server has drivers in memory
- Try the HTTP API fallback: `https://ws.egoobus.com/api/drivers`

## 10. Enhanced Logging

The WebSocket server now includes enhanced logging:
- Connection attempts with origin information
- Admin client connections
- Driver location updates
- Broadcast status to admin clients
- Total driver count

Review server logs to identify where the issue occurs.

## 11. Quick Checklist

- [ ] WebSocket server is running
- [ ] Dashboard shows "Connected" (green indicator)
- [ ] Browser console shows WebSocket messages
- [ ] Driver app is running and connected
- [ ] Driver has sent at least one location update
- [ ] Driver status is "active"
- [ ] Map filters are not hiding drivers
- [ ] WebSocket server logs show driver updates
- [ ] WebSocket server logs show broadcasts to admin clients

## Still Not Working?

1. Check WebSocket server logs for detailed information
2. Check browser console for errors
3. Verify driver is actually online and sending updates
4. Test WebSocket connection manually using browser console
5. Check if HTTP API fallback works: `https://ws.egoobus.com/api/drivers`

