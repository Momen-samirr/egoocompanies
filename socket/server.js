const express = require("express");
const { WebSocketServer } = require("ws");
const geolib = require("geolib");

const app = express();
app.use(express.json());
// Use port 3001 for HTTP server to avoid conflict with Next.js (port 3000)
// The WebSocket server runs on port 8080 which is what the dashboard needs
const PORT = process.env.PORT || 3001;

// Store driver locations with additional info
let drivers = {};
let activeRides = {};
// Store user connections by userId
let userConnections = {};

// Create WebSocket server
const WS_PORT = 8080;
const wss = new WebSocketServer({ port: WS_PORT });

wss.on('listening', () => {
  console.log(`✅ WebSocket server started on port ${WS_PORT}`);
});

wss.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${WS_PORT} is already in use!`);
    console.error(`   Please stop the existing server:`);
    console.error(`   npm run stop`);
    console.error(`   or: lsof -ti:${WS_PORT} | xargs kill -9\n`);
    process.exit(1);
  } else {
    console.error('WebSocket server error:', error);
    process.exit(1);
  }
});

// Broadcast driver locations to all admin clients
const broadcastToAdmins = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client.isAdmin) {
      // 1 = OPEN
      client.send(JSON.stringify(data));
    }
  });
};

// Send message to a specific user by userId
const sendToUser = (userId, data) => {
  const userWs = userConnections[userId];
  if (userWs && userWs.readyState === 1) {
    // 1 = OPEN
    userWs.send(JSON.stringify(data));
    console.log(`✅ Sent message to user ${userId}:`, data.type);
    return true;
  } else {
    console.log(`⚠️ User ${userId} not connected - message not sent`);
    return false;
  }
};

wss.on("connection", (ws, req) => {
  // Check if this is an admin connection (from dashboard)
  let isAdmin = false;
  try {
    // Parse URL to get query parameters
    const urlString = req.url || "";
    const url = new URL(urlString, `http://${req.headers.host || "localhost"}`);
    isAdmin = url.searchParams.get("role") === "admin";
  } catch (error) {
    // Fallback: check if URL contains role=admin
    if (req.url && req.url.includes("role=admin")) {
      isAdmin = true;
    }
    console.log("URL parsing fallback, isAdmin:", isAdmin);
  }
  ws.isAdmin = isAdmin;

  // Set up ping/pong keepalive to prevent connection timeouts
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  // Handle WebSocket errors
  ws.on("error", (error) => {
    console.error(`❌ WebSocket error for ${isAdmin ? "admin" : "client"}:`, error.message || error);
  });

  if (isAdmin) {
    console.log("👤 Admin client connected");
    // Send current driver locations to new admin client
    ws.send(
      JSON.stringify({
        type: "driverLocations",
        drivers: drivers,
      })
    );
    // Send active rides
    ws.send(
      JSON.stringify({
        type: "activeRides",
        rides: activeRides,
      })
    );
  } else {
    console.log("🔌 Client connected (driver or user)");
    // Try to get userId from query params
    try {
      const urlString = req.url || "";
      const url = new URL(urlString, `http://${req.headers.host || "localhost"}`);
      const userId = url.searchParams.get("userId");
      if (userId) {
        ws.userId = userId;
        userConnections[userId] = ws;
        console.log(`👤 User ${userId} connected and registered`);
      }
    } catch (error) {
      console.log("Could not parse userId from connection URL");
    }
  }

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log("Received message:", data);

      if (data.type === "locationUpdate" && data.role === "driver") {
        // Store driver ID in the WebSocket connection for cleanup on disconnect
        ws.driverId = data.driver;
        
        const driverStatus = data.data.status || "active";
        
        drivers[data.driver] = {
          id: data.driver,
          latitude: data.data.latitude,
          longitude: data.data.longitude,
          name: data.data.name || "Driver",
          status: driverStatus,
          vehicleType: data.data.vehicleType || "Car",
          timestamp: new Date().toISOString(),
        };
        console.log(`✅ Updated driver location: ID=${data.driver}, Status=${driverStatus}, Name=${drivers[data.driver].name}, Lat=${data.data.latitude}, Lng=${data.data.longitude}`);

        // Broadcast to all admin clients
        broadcastToAdmins({
          type: "driverLocationUpdate",
          driver: drivers[data.driver],
        });
      }

      if (data.type === "requestRide" && data.role === "user") {
        // Register user connection if userId is provided
        if (data.userId) {
          ws.userId = data.userId;
          userConnections[data.userId] = ws;
          console.log(`👤 User ${data.userId} registered for ride updates`);
        }
        
        console.log("Requesting ride...");
        console.log(`User location: ${data.latitude}, ${data.longitude}`);
        console.log(`Total drivers in system: ${Object.keys(drivers).length}`);
        console.log("All drivers:", JSON.stringify(drivers, null, 2));
        const nearbyDrivers = findNearbyDrivers(data.latitude, data.longitude);
        console.log(`Found ${nearbyDrivers.length} nearby drivers`);
        if (nearbyDrivers.length > 0) {
          console.log("Nearby drivers:", JSON.stringify(nearbyDrivers, null, 2));
        }
        ws.send(
          JSON.stringify({ type: "nearbyDrivers", drivers: nearbyDrivers })
        );
      }

      // Handle user registration message
      if (data.type === "registerUser" && data.role === "user" && data.userId) {
        ws.userId = data.userId;
        userConnections[data.userId] = ws;
        console.log(`👤 User ${data.userId} registered for updates`);
        ws.send(JSON.stringify({ type: "registered", message: "User registered successfully" }));
      }

      if (data.type === "driverStatusChange" && data.role === "driver") {
        // Store driver ID in the WebSocket connection for cleanup on disconnect
        ws.driverId = data.driver;
        
        if (data.status === "inactive") {
          // Remove driver from available drivers when they go inactive
          console.log(`Driver ${data.driver} went inactive - removing from available drivers`);
          delete drivers[data.driver];
          // Broadcast removal to admin clients
          broadcastToAdmins({
            type: "driverRemoved",
            driverId: data.driver,
          });
        } else if (data.status === "active") {
          console.log(`Driver ${data.driver} went active`);
          // Driver will be added back when they send their next location update
        }
      }

      if (data.type === "rideStatusUpdate") {
        const { rideId, status, pickup, destination } = data;
        if (status === "In Progress" || status === "Accepted") {
          activeRides[rideId] = {
            id: rideId,
            status,
            pickup,
            destination,
            driverId: data.driverId,
            userId: data.userId,
            timestamp: new Date().toISOString(),
          };
        } else {
          delete activeRides[rideId];
        }

        // Broadcast to admin clients
        broadcastToAdmins({
          type: "activeRidesUpdate",
          rides: activeRides,
        });
      }
    } catch (error) {
      console.log("Failed to parse WebSocket message:", error);
    }
  });

  ws.on("close", (code, reason) => {
    const reasonStr = reason ? reason.toString() : "No reason provided";
    if (ws.isAdmin) {
      console.log(`👤 Admin client disconnected: code=${code}, reason="${reasonStr}"`);
    } else if (ws.driverId) {
      // If a driver disconnects, remove them from available drivers
      console.log(`🚗 Driver ${ws.driverId} disconnected: code=${code}, reason="${reasonStr}" - removing from available drivers`);
      delete drivers[ws.driverId];
      // Broadcast removal to admin clients
      broadcastToAdmins({
        type: "driverRemoved",
        driverId: ws.driverId,
      });
    } else if (ws.userId) {
      // If a user disconnects, remove them from user connections
      console.log(`👤 User ${ws.userId} disconnected: code=${code}, reason="${reasonStr}"`);
      delete userConnections[ws.userId];
    } else {
      console.log(`🔌 Client disconnected: code=${code}, reason="${reasonStr}"`);
    }
  });
});

// Set up ping interval to keep connections alive and detect dead connections
// Send ping every 30 seconds
const PING_INTERVAL = 30000; // 30 seconds
const PING_TIMEOUT = 60000; // 60 seconds - if no pong received, close connection

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log(`💀 Terminating dead connection (${ws.isAdmin ? "admin" : "client"})`);
      ws.terminate();
      return;
    }

    ws.isAlive = false;
    try {
      ws.ping(() => {
        // Ping sent successfully
      });
    } catch (error) {
      console.error(`❌ Error sending ping:`, error);
      ws.terminate();
    }
  });
}, PING_INTERVAL);

const findNearbyDrivers = (userLat, userLon) => {
  console.log(`🔍 Finding nearby drivers for location: ${userLat}, ${userLon}`);
  console.log(`📊 Total drivers registered: ${Object.keys(drivers).length}`);
  
  const nearbyDrivers = Object.entries(drivers)
    .filter(([id, driver]) => {
      console.log(`\n🚗 Checking driver ${id}:`);
      console.log(`   Status: "${driver.status}" (type: ${typeof driver.status})`);
      console.log(`   Location: ${driver.latitude}, ${driver.longitude}`);
      
      // Only include active drivers - check status with flexible comparison
      const isActive = driver.status === "active" || driver.status === "Active" || String(driver.status).toLowerCase() === "active";
      
      if (!isActive) {
        console.log(`   ❌ Driver ${id} is not active (status: "${driver.status}") - excluding`);
        return false;
      }
      
      // Check distance (within 5 kilometers)
      const distance = geolib.getDistance(
        { latitude: userLat, longitude: userLon },
        { latitude: driver.latitude, longitude: driver.longitude }
      );
      const isWithinRange = distance <= 5000; // 5 kilometers
      
      if (!isWithinRange) {
        console.log(`   ❌ Driver ${id} is too far away (${distance}m = ${(distance/1000).toFixed(2)}km) - excluding`);
      } else {
        console.log(`   ✅ Driver ${id} is within range (${distance}m = ${(distance/1000).toFixed(2)}km)`);
      }
      
      return isWithinRange;
    })
    .map(([id, driver]) => ({ id, ...driver }));
  
  console.log(`\n✅ Total nearby active drivers found: ${nearbyDrivers.length}`);
  return nearbyDrivers;
};

// API endpoint to get current driver locations (for HTTP requests)
app.get("/api/drivers", (req, res) => {
  res.json({ drivers });
});

// API endpoint to get active rides
app.get("/api/active-rides", (req, res) => {
  res.json({ rides: activeRides });
});

// API endpoint to notify user when ride is accepted (called from backend server)
app.post("/api/notify-ride-accepted", (req, res) => {
  try {
    const { userId, rideData } = req.body;
    
    if (!userId || !rideData) {
      return res.status(400).json({ success: false, message: "userId and rideData are required" });
    }

    console.log(`📢 Notifying user ${userId} about accepted ride`);
    console.log(`📦 Ride data:`, JSON.stringify(rideData, null, 2));

    // Send WebSocket message to user if connected
    const sent = sendToUser(userId, {
      type: "rideAccepted",
      rideData: rideData,
    });

    res.json({ 
      success: true, 
      delivered: sent,
      message: sent ? "Notification sent to user" : "User not connected, will receive push notification"
    });
  } catch (error) {
    console.error("Error notifying user:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API endpoint to notify user when ride is completed (called from backend server)
app.post("/api/notify-ride-completed", (req, res) => {
  try {
    const { userId, rideId, rideData } = req.body;
    
    if (!userId || !rideId) {
      return res.status(400).json({ success: false, message: "userId and rideId are required" });
    }

    console.log(`✅ Notifying user ${userId} about completed ride ${rideId}`);
    console.log(`📦 Ride data:`, JSON.stringify(rideData, null, 2));

    // Send WebSocket message to user if connected
    const sent = sendToUser(userId, {
      type: "rideCompleted",
      rideId: rideId,
      rideData: rideData,
    });

    res.json({ 
      success: true, 
      delivered: sent,
      message: sent ? "Notification sent to user" : "User not connected"
    });
  } catch (error) {
    console.error("Error notifying user about ride completion:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`HTTP API server is running on port ${PORT}`);
  console.log(`\n✅ Ready to accept WebSocket connections from dashboard`);
  console.log(`   Connect to: ws://localhost:${WS_PORT}?role=admin\n`);
}).on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`);
    console.error(`   The WebSocket server on port ${WS_PORT} is still running.`);
    console.error(`   You can ignore this if you only need WebSocket functionality.`);
  } else {
    throw error;
  }
});
