# MongoDB Atlas Connection Fix

## Problem
You're getting a connection timeout error:
```
PrismaClientKnownRequestError: Server selection timeout: No available servers
```

This means your server cannot connect to MongoDB Atlas.

## Solution 1: Whitelist Your IP Address (Most Common Fix)

### For Development (Local Server):

1. **Get your current IP address:**
   ```bash
   # On Linux/Mac:
   curl ifconfig.me
   
   # Or visit:
   # https://whatismyipaddress.com/
   ```

2. **Whitelist in MongoDB Atlas:**
   - Go to [MongoDB Atlas Dashboard](https://cloud.mongodb.com)
   - Click on **Network Access** (left sidebar)
   - Click **ADD IP ADDRESS**
   - Choose one of these options:
     - **Option A (Development only - allows all IPs):** 
       - Enter: `0.0.0.0/0`
       - Click **Confirm**
     - **Option B (More secure - only your current IP):**
       - Enter your IP address (e.g., `192.168.1.100`)
       - Click **Confirm**

3. **Wait 1-2 minutes** for changes to propagate

4. **Restart your server**

### For Production/Deployed Server:

1. Get your server's public IP address
2. Add it to MongoDB Atlas Network Access whitelist
3. If using dynamic IP, consider using `0.0.0.0/0` (less secure but works everywhere)

## Solution 2: Check Your Connection String

Verify your `DATABASE_URL` in `server/.env` file:

```env
DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority"
```

**Important points:**
- Replace `username` and `password` with your MongoDB Atlas credentials
- Replace `cluster` with your cluster name
- Replace `database` with your database name
- The URL should include `?retryWrites=true&w=majority` at the end

### To get your connection string:
1. Go to MongoDB Atlas → **Database** → **Connect**
2. Choose **Connect your application**
3. Copy the connection string
4. Replace `<password>` with your actual password
5. Replace `<database>` with your database name

## Solution 3: Verify Database User Permissions

1. Go to MongoDB Atlas → **Database Access**
2. Make sure your database user:
   - Exists
   - Has the correct password
   - Has proper permissions (at least **Read and write to any database** for development)

## Solution 4: Check Firewall/VPN

- **Disable VPN** temporarily to test
- **Check firewall settings** on your server/computer
- **If on a corporate network**, contact IT to allow MongoDB Atlas connections (ports 27017, or HTTPS for MongoDB Atlas)

## Solution 5: Test Connection

After fixing, test the connection:

```bash
# From server directory
cd server
npm run dev
```

Look for:
- ✅ No connection errors
- ✅ Server starts successfully
- ✅ Can make API calls that query the database

## Common Issues:

### Issue: "Authentication failed"
- **Fix:** Check username/password in DATABASE_URL

### Issue: "Database name not found"
- **Fix:** Make sure database name in connection string matches your actual database

### Issue: "IP not whitelisted"
- **Fix:** Add IP to Network Access whitelist (Solution 1)

### Issue: Timeout persists after whitelisting
- **Check:** Wait 2-3 minutes for changes to propagate
- **Check:** Verify connection string format is correct
- **Check:** Make sure MongoDB Atlas cluster is running (not paused)

## Quick Fix for Development:

If you're in development and need to test quickly:

1. In MongoDB Atlas → **Network Access**
2. Click **ADD IP ADDRESS**
3. Click **ALLOW ACCESS FROM ANYWHERE** button
4. Confirm
5. Wait 1-2 minutes
6. Restart server

**⚠️ Warning:** `0.0.0.0/0` allows access from any IP. Only use this for development!

## Still Having Issues?

1. Check MongoDB Atlas status: https://status.mongodb.com/
2. Verify your cluster is not paused (check MongoDB Atlas Dashboard)
3. Check server logs for more detailed error messages
4. Test connection string directly using MongoDB Compass or mongosh

