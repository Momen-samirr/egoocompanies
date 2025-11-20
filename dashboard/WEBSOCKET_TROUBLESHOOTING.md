# WebSocket Connection Troubleshooting

## Common Issues and Solutions

### Issue: WebSocket connection failed

**Error:** `WebSocket connection to 'ws://localhost:8080?role=admin' failed`

### Solutions:

#### 1. Check if WebSocket Server is Running

The WebSocket server must be running on port 8080. Start it with:

```bash
cd socket
node server.js
```

You should see:
```
Server is running on port 3000
WebSocket server is running on port 8080
```

#### 2. Check Environment Variable

Make sure your `.env.local` file has the correct WebSocket URL:

```env
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:8080
```

**For remote connections** (if accessing from another device):
```env
NEXT_PUBLIC_WEBSOCKET_URL=ws://192.168.1.13:8080
```

Replace `192.168.1.13` with your server's IP address.

#### 3. Check Firewall Settings

Ensure port 8080 is not blocked by your firewall:
- Linux: `sudo ufw allow 8080`
- Windows: Check Windows Firewall settings
- macOS: Check System Preferences > Security & Privacy > Firewall

#### 4. Check Network Configuration

- **Local development**: Use `ws://localhost:8080`
- **Same network**: Use `ws://YOUR_IP:8080` (e.g., `ws://192.168.1.13:8080`)
- **Production**: Use `wss://your-domain.com:8080` (secure WebSocket)

#### 5. Verify WebSocket Server Code

The server should be listening on port 8080. Check `socket/server.js`:

```javascript
const wss = new WebSocketServer({ port: 8080 });
```

#### 6. Test WebSocket Connection Manually

You can test the WebSocket connection using browser console:

```javascript
const ws = new WebSocket('ws://localhost:8080?role=admin');
ws.onopen = () => console.log('Connected!');
ws.onerror = (error) => console.error('Error:', error);
ws.onmessage = (event) => console.log('Message:', event.data);
```

#### 7. Check Browser Console

Open browser DevTools (F12) and check:
- Console tab for error messages
- Network tab to see if WebSocket connection is attempted
- Look for any CORS or connection errors

### Common Error Messages:

1. **"Connection refused"**
   - WebSocket server is not running
   - Wrong port number
   - Firewall blocking the connection

2. **"Failed to construct 'WebSocket'"**
   - Invalid URL format
   - Missing `ws://` or `wss://` prefix
   - URL contains invalid characters

3. **"Network error"**
   - Server is unreachable
   - Network connectivity issues
   - Wrong IP address or hostname

### Quick Fix Checklist:

- [ ] WebSocket server is running (`node socket/server.js`)
- [ ] Port 8080 is not blocked by firewall
- [ ] `.env.local` has correct `NEXT_PUBLIC_WEBSOCKET_URL`
- [ ] URL format is correct (`ws://host:port`)
- [ ] Restart Next.js dev server after changing `.env.local`
- [ ] Check browser console for detailed error messages

### Restart Instructions:

1. Stop the WebSocket server (Ctrl+C)
2. Start it again: `cd socket && node server.js`
3. Restart the dashboard: `cd dashboard && npm run dev`
4. Refresh the browser page

### Production Deployment:

For production, use secure WebSocket (WSS):
- Set up SSL/TLS certificate
- Use `wss://` instead of `ws://`
- Configure reverse proxy (nginx/Apache) if needed

