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

- **WebSocket Server**: Port 8080 (required for dashboard)
- **HTTP API Server**: Port 3001 (optional, for HTTP endpoints)

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

- `PORT`: HTTP server port (default: 3001)

## Logs

The server logs:
- Admin client connections/disconnections
- Driver location updates
- Active ride status changes

