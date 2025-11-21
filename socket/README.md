# WebSocket Server

Real-time WebSocket server for driver location tracking and ride management.

## Quick Start

```bash
npm start
```

Or directly:
```bash
node server.js
```

## Ports

- **Server Port**: Uses `PORT` environment variable (set automatically by Render)
- **Default (local)**: Port 8080
- **Both HTTP and WebSocket** run on the same port (required for Render deployment)

## Stopping the Server

Press `Ctrl+C` in the terminal where the server is running.

## If Port is Already in Use

If you get `EADDRINUSE` error, stop the existing server:

```bash
# Find and kill process on port 8080
lsof -ti:8080 | xargs kill -9

# Or find the process ID first
lsof -ti:8080
# Then kill it: kill -9 <PID>
```

## Features

- Real-time driver location updates
- Admin dashboard connections
- Active ride tracking
- Nearby driver finding

## Environment Variables

- `PORT`: Server port for both HTTP and WebSocket (default: 8080)
  - **Render**: Automatically sets this - no need to configure
  - **Local**: Uses 8080 by default

## Logs

The server logs:
- Admin client connections/disconnections
- Driver location updates
- Active ride status changes

