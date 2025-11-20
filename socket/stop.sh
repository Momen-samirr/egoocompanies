#!/bin/bash
# Script to stop the WebSocket server

echo "Stopping WebSocket server on port 8080..."

PID=$(lsof -ti:8080)
if [ -z "$PID" ]; then
  echo "No process found on port 8080"
else
  kill -9 $PID
  echo "✅ Stopped process $PID on port 8080"
fi

# Also check port 3001 (HTTP server)
PID_HTTP=$(lsof -ti:3001)
if [ ! -z "$PID_HTTP" ]; then
  kill -9 $PID_HTTP
  echo "✅ Stopped HTTP server process $PID_HTTP on port 3001"
fi

echo "Done!"

