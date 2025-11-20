# Quick Fix: WebSocket Connection Issue

## Problem
Dashboard shows "WebSocket disconnected" error.

## Solution

### Step 1: Check if Server is Running
```bash
lsof -ti:8080
```
If nothing is returned, the server is not running.

### Step 2: Start the WebSocket Server
```bash
cd socket
node server.js
```

You should see:
```
✅ WebSocket server started on port 8080
HTTP API server is running on port 3001

✅ Ready to accept WebSocket connections from dashboard
   Connect to: ws://localhost:8080?role=admin
```

### Step 3: Check Your .env.local File

Make sure `dashboard/.env.local` has the correct WebSocket URL:

**For local development:**
```env
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:8080
```

**For network access (if accessing from another device):**
```env
NEXT_PUBLIC_WEBSOCKET_URL=ws://192.168.1.13:8080
```
(Replace `192.168.1.13` with your server's actual IP address)

### Step 4: Restart Dashboard

After changing `.env.local`, restart the Next.js dev server:
```bash
cd dashboard
# Stop with Ctrl+C, then:
npm run dev
```

### Step 5: Verify Connection

1. Open browser DevTools (F12)
2. Go to Console tab
3. Navigate to `/dashboard/map`
4. Look for: `🔌 Connecting to WebSocket: ws://...`
5. Should see: `✅ Connected to WebSocket server`

## Common Issues

### Issue: "Connection timeout"
- Server is not running → Start it with `cd socket && node server.js`
- Wrong IP address → Check `.env.local` has correct IP
- Firewall blocking → Check firewall settings for port 8080

### Issue: "Connection refused"
- Server crashed → Restart it
- Wrong port → Verify server is on port 8080

### Issue: URL shows `192.168.1.13` but can't connect
- Try using `localhost` instead: `ws://localhost:8080`
- Or verify the IP address is correct
- Check if you're on the same network

## Quick Test

Test WebSocket connection in browser console:
```javascript
const ws = new WebSocket('ws://localhost:8080?role=admin');
ws.onopen = () => console.log('✅ Connected!');
ws.onerror = (e) => console.error('❌ Error:', e);
ws.onmessage = (e) => console.log('📨 Message:', e.data);
```

If this works, the server is fine and the issue is with the dashboard connection logic.

