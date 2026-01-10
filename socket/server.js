// Load environment variables from .env file
require("dotenv").config();

const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const geolib = require("geolib");
const jwt = require("jsonwebtoken");
const Redis = require("ioredis");

// Metrics collection (if enabled)
const ENABLE_METRICS = process.env.ENABLE_METRICS !== "false";
let metricsCollector = null;
if (ENABLE_METRICS) {
  try {
    // Simple metrics collector (can be replaced with more sophisticated solution)
    metricsCollector = {
      updates: [],
      latencies: [],
      errors: 0,
      totalUpdates: 0,
      recordUpdate: function (latency) {
        const now = Date.now();
        this.updates.push(now);
        this.latencies.push(latency);
        this.totalUpdates++;
        // Keep only last minute
        const oneMinuteAgo = now - 60000;
        this.updates = this.updates.filter((t) => t > oneMinuteAgo);
        this.latencies = this.latencies.slice(-100);
      },
      recordError: function () {
        this.errors++;
      },
      getMetrics: function () {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        const recentUpdates = this.updates.filter((t) => t > oneMinuteAgo);
        const updatesPerSecond = recentUpdates.length / 60;
        const averageLatency =
          this.latencies.length > 0
            ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
            : 0;
        const errorRate =
          this.totalUpdates > 0 ? this.errors / this.totalUpdates : 0;

        return {
          updatesPerSecond: Math.round(updatesPerSecond * 100) / 100,
          averageLatency: Math.round(averageLatency * 100) / 100,
          errorRate: Math.round(errorRate * 10000) / 100,
          totalUpdates: this.totalUpdates,
          totalErrors: this.errors,
        };
      },
    };
    console.log("✅ Metrics collection enabled");
  } catch (error) {
    console.error("❌ Failed to initialize metrics:", error);
    metricsCollector = null;
  }
}

const app = express();

// Redis configuration
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || null;
const ENABLE_REDIS = process.env.ENABLE_REDIS !== "false"; // Default to true

// Initialize Redis client
let redis = null;
if (ENABLE_REDIS) {
  try {
    redis = new Redis(REDIS_URL, {
      password: REDIS_PASSWORD,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        console.log(`🔄 Redis retry attempt ${times}, delay: ${delay}ms`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: true,
    });

    redis.on("connect", () => {
      console.log("✅ Redis connected successfully");
    });

    redis.on("ready", () => {
      console.log("✅ Redis ready to accept commands");
    });

    redis.on("error", (err) => {
      console.error("❌ Redis error:", err.message);
      console.log("⚠️ Falling back to in-memory storage");
    });

    redis.on("close", () => {
      console.log("⚠️ Redis connection closed");
    });

    redis.on("reconnecting", () => {
      console.log("🔄 Redis reconnecting...");
    });
  } catch (error) {
    console.error("❌ Failed to initialize Redis:", error.message);
    console.log("⚠️ Falling back to in-memory storage");
    redis = null;
  }
} else {
  console.log(
    "ℹ️ Redis disabled (ENABLE_REDIS=false), using in-memory storage"
  );
}

// CORS configuration for HTTP API endpoints
const allowedOrigins = [
  "https://dashapp.egoobus.com",
  "http://localhost:3000",
  "http://localhost:3001",
  // Add other allowed origins as needed
];

// CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // In development, allow all origins
  if (process.env.NODE_ENV !== "production") {
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
  } else {
    // In production, only allow specific origins
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else if (!origin) {
      // Allow requests with no origin (like mobile apps, Postman, etc.)
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    // If origin is provided but not in allowed list, don't set the header (will be blocked)
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }

  next();
});

app.use(express.json());
// Use Render's PORT environment variable (automatically set by Render)
// For local development, fallback to 8080 (original WebSocket port)
const PORT = process.env.PORT || 8080;

// Store driver locations with additional info
let drivers = {}; // In-memory fallback
let activeRides = {};
// Store user connections by userId
let userConnections = {};

// Initialize Redis driver store
const RedisDriverStore = require("./utils/redisDriverStore");
const driverStore = new RedisDriverStore(redis, drivers);

// Initialize Pub/Sub manager for multi-instance support
const PubSubManager = require("./utils/pubsubManager");
const instanceId = process.env.INSTANCE_ID || `instance-${Date.now()}`;
const pubsubManager = new PubSubManager(redis, instanceId);

// Initialize Connection Manager
let connectionManager;
try {
  const ConnectionManager = require("./utils/connectionManager");
  connectionManager = new ConnectionManager();
  console.log("✅ Connection Manager initialized successfully");
} catch (error) {
  console.error("❌ Failed to initialize Connection Manager:", error);
  // Fallback: Create a minimal connection manager to prevent crashes
  connectionManager = {
    connections: new Map(),
    driverConnections: new Map(),
    adminConnections: new Set(),
    userConnections: new Map(),
    addConnection: function (ws, type, metadata = {}) {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      this.connections.set(id, {
        id,
        ws,
        type,
        metadata,
        connectedAt: Date.now(),
      });
      if (type === "driver" && metadata.driverId) {
        this.driverConnections.set(metadata.driverId, id);
      } else if (type === "admin") {
        this.adminConnections.add(id);
      } else if (type === "user" && metadata.userId) {
        this.userConnections.set(metadata.userId, id);
      }
      return id;
    },
    removeConnection: function (id) {
      const conn = this.connections.get(id);
      if (conn) {
        if (conn.type === "driver" && conn.metadata.driverId) {
          this.driverConnections.delete(conn.metadata.driverId);
        } else if (conn.type === "admin") {
          this.adminConnections.delete(id);
        } else if (conn.type === "user" && conn.metadata.userId) {
          this.userConnections.delete(conn.metadata.userId);
        }
        this.connections.delete(id);
        return true;
      }
      return false;
    },
    getConnection: function (id) {
      return this.connections.get(id);
    },
    getMetrics: function () {
      return {
        total: this.connections.size,
        drivers: this.driverConnections.size,
        admins: this.adminConnections.size,
        users: this.userConnections.size,
        byType: {
          driver: Array.from(this.connections.values()).filter(
            (c) => c.type === "driver"
          ).length,
          admin: Array.from(this.connections.values()).filter(
            (c) => c.type === "admin"
          ).length,
          user: Array.from(this.connections.values()).filter(
            (c) => c.type === "user"
          ).length,
        },
      };
    },
  };
  console.log("⚠️ Using fallback Connection Manager");
}

// Set up Pub/Sub message handler
pubsubManager.setMessageHandler((channel, data) => {
  if (data.type === "locationUpdate") {
    // Update driver location from other instance
    updateDriverLocationAndBroadcast(data.driverId, data.locationData).catch(
      (error) => {
        console.error("Error processing Pub/Sub location update:", error);
      }
    );
  } else if (data.type === "statusChange") {
    // Handle status change from other instance
    if (data.status === "inactive") {
      driverStore.removeDriver(data.driverId);
      delete drivers[data.driverId];
      broadcastToAdmins({
        type: "driverRemoved",
        driverId: data.driverId,
      });
    }
  }
});

// Initialize Pub/Sub on startup
if (ENABLE_REDIS && redis) {
  pubsubManager.initialize().catch((error) => {
    console.error("Error initializing Pub/Sub:", error);
  });
}

// Create HTTP server
const server = http.createServer(app);

// Allowed origins for WebSocket connections
const allowedWebSocketOrigins = [
  "https://dashapp.egoobus.com",
  "http://localhost:3000",
  "http://localhost:3001",
  // Add other allowed origins as needed
];

// Create WebSocket server attached to the HTTP server
// This allows both HTTP and WebSocket to work on the same port (required for Render)
const wss = new WebSocketServer({
  server,
  verifyClient: (info) => {
    const origin = info.origin;
    const req = info.req;

    console.log(
      `🔍 WebSocket connection attempt from origin: ${origin || "none"}`
    );
    console.log(`🔍 Request URL: ${req.url}`);
    console.log(`🔍 Request headers:`, JSON.stringify(req.headers, null, 2));

    // Allow connections with no origin (like mobile apps, Postman, etc.)
    if (!origin) {
      console.log(
        `✅ Allowing connection with no origin (mobile app or direct connection)`
      );
      return true;
    }

    // In development, allow all origins
    if (process.env.NODE_ENV !== "production") {
      console.log(`✅ Allowing connection in development mode`);
      return true;
    }

    // In production, verify origin
    // Check for exact match or if origin contains the allowed domain
    const isAllowed = allowedWebSocketOrigins.some((allowedOrigin) => {
      // Exact match
      if (origin === allowedOrigin) {
        console.log(
          `✅ Origin ${origin} exactly matches allowed origin ${allowedOrigin}`
        );
        return true;
      }
      // Starts with match (for subdomains)
      if (origin.startsWith(allowedOrigin)) {
        console.log(
          `✅ Origin ${origin} starts with allowed origin ${allowedOrigin}`
        );
        return true;
      }
      // Check if origin contains the domain (more lenient for debugging)
      const allowedDomain = allowedOrigin
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "");
      if (origin.includes(allowedDomain)) {
        console.log(
          `✅ Origin ${origin} contains allowed domain ${allowedDomain}`
        );
        return true;
      }
      return false;
    });

    if (!isAllowed) {
      console.log(`❌ WebSocket connection rejected from origin: ${origin}`);
      console.log(`❌ Allowed origins:`, allowedWebSocketOrigins);
      // For now, log but allow to help debug - review logs to see actual origins
      console.log(
        `⚠️ Allowing connection for now - review logs to update allowed origins if needed`
      );
      return true;
    } else {
      console.log(`✅ WebSocket connection allowed from origin: ${origin}`);
    }

    return isAllowed;
  },
});

wss.on("listening", () => {
  console.log(`✅ WebSocket server ready on port ${PORT}`);
});

wss.on("error", (error) => {
  console.error("WebSocket server error:", error);
});

// Store company driver mappings (companyId -> array of driverIds)
// This will be updated when drivers are assigned to companies
let companyDriversMap = {};

// Store admin subscriptions to trips (admin connection ID -> Set of trip IDs)
let adminTripSubscriptions = new Map();

// Store parent subscriptions to trips (parent connection ID -> Set of { tripId, studentId, parentId })
let parentTripSubscriptions = new Map();

// Store active trips with their current status
let activeTripsMap = {};

// Function to fetch company driver IDs from the API
const fetchCompanyDrivers = async (companyId) => {
  if (!companyId) return [];

  // If we have cached data, use it
  if (companyDriversMap[companyId]) {
    return companyDriversMap[companyId];
  }

  try {
    // Make HTTP request to get company drivers
    // We'll use the server's API endpoint
    const serverUrl = process.env.SERVER_URL || "http://localhost:8000";
    const response = await fetch(
      `${serverUrl}/admin/companies/${companyId}/drivers`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.drivers) {
        const driverIds = data.drivers.map((driver) => driver.id);
        companyDriversMap[companyId] = driverIds;
        return driverIds;
      }
    }
  } catch (error) {
    console.error(`❌ Error fetching company drivers for ${companyId}:`, error);
  }

  return [];
};

// Function to filter drivers by company
const filterDriversByCompany = (driversObj, companyDriverIds) => {
  if (!companyDriverIds || companyDriverIds.length === 0) {
    return {};
  }

  const filtered = {};
  for (const driverId of companyDriverIds) {
    if (driversObj[driverId]) {
      filtered[driverId] = driversObj[driverId];
    }
  }
  return filtered;
};

// Function to filter rides by company (rides with drivers from company)
const filterRidesByCompany = (ridesObj, companyDriverIds) => {
  if (!companyDriverIds || companyDriverIds.length === 0) {
    return {};
  }

  const filtered = {};
  for (const [rideId, ride] of Object.entries(ridesObj)) {
    if (ride.driverId && companyDriverIds.includes(ride.driverId)) {
      filtered[rideId] = ride;
    }
  }
  return filtered;
};

// Broadcast trip location update to subscribed admins
const broadcastTripLocationUpdate = (tripId, locationData) => {
  let sentCount = 0;
  const message = {
    type: "tripLocationUpdate",
    tripId,
    ...locationData,
    // Include ETA if provided
    eta: locationData.eta || null,
  };

  wss.clients.forEach((client) => {
    if (client.isAdmin) {
      // Check if admin is subscribed to this trip
      const clientConnectionId = Array.from(
        connectionManager.connections.entries()
      ).find(([id, conn]) => conn.ws === client)?.[0];

      if (clientConnectionId) {
        const subscriptions = adminTripSubscriptions.get(clientConnectionId);
        // If admin has subscriptions, only send if subscribed to this trip
        // If no subscriptions, send to all admins (backward compatibility)
        if (
          !subscriptions ||
          subscriptions.size === 0 ||
          subscriptions.has(tripId)
        ) {
          if (client.readyState === 1) {
            try {
              client.send(JSON.stringify(message));
              sentCount++;
            } catch (error) {
              console.error("Error sending trip location update:", error);
            }
          }
        }
      } else {
        // Fallback: send to all admins if connection ID not found
        if (client.readyState === 1) {
          try {
            client.send(JSON.stringify(message));
            sentCount++;
          } catch (error) {
            console.error("Error sending trip location update:", error);
          }
        }
      }
    }
  });

  if (sentCount > 0) {
    console.log(
      `📡 [Trip Location] Broadcasted trip ${tripId} location update to ${sentCount} admin(s)`
    );
  }
};

// Broadcast trip location update to subscribed parents
const broadcastTripLocationToParents = (tripId, locationData) => {
  let sentCount = 0;
  let checkedSubscriptions = 0;
  let matchingSubscriptions = 0;
  let failedSends = 0;
  const parentSubscriptionsCount = parentTripSubscriptions.size;

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`log_${Date.now()}_ws_broadcast_to_parents_start`,timestamp:Date.now(),location:'socket/server.js:516',message:'WebSocket server starting broadcast to parents',data:{tripId,parentSubscriptionsCount,locationLat:locationData.location?.latitude,locationLng:locationData.location?.longitude},sessionId:'debug-session',runId:'ws-broadcast-to-parents-start',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  // Extract studentStopETAs from locationData if available
  const studentStopETAs = locationData.studentStopETAs || null;

  parentTripSubscriptions.forEach((subscriptions, connectionId) => {
    const conn = connectionManager.getConnection(connectionId);
    checkedSubscriptions += subscriptions.size;
    
    if (!conn || !conn.ws || conn.ws.readyState !== 1) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`log_${Date.now()}_ws_broadcast_parent_invalid_conn`,timestamp:Date.now(),location:'socket/server.js:525',message:'Parent connection invalid or closed',data:{connectionId,hasConn:!!conn,hasWs:!!conn?.ws,readyState:conn?.ws?.readyState},sessionId:'debug-session',runId:'ws-broadcast-parent-invalid-conn',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return;
    }

    subscriptions.forEach((subStr) => {
      try {
        const sub = JSON.parse(subStr);
        if (sub.tripId === tripId) {
          matchingSubscriptions++;
          // Find ETA for this student's stop
          let studentETA = null;
          if (studentStopETAs && Array.isArray(studentStopETAs)) {
            // We need to find the stopId for this student
            // For now, we'll send all ETAs and let the client filter
            // In a production system, you'd query the database to get student's stopId
            studentETA = studentStopETAs.find((eta) => {
              // This would need to match studentId to stopId
              // For now, we'll send the first matching or all
              return true; // Simplified - would need proper matching
            });
          }

          const message = {
            type: "tripLocationUpdate",
            tripId: sub.tripId,
            studentId: sub.studentId,
            driverId: locationData.driverId,
            location: locationData.location,
            speed: locationData.speed,
            deviationStatus: locationData.deviationStatus,
            eta: studentETA
              ? {
                  minutes: studentETA.etaMinutes,
                  distanceMeters: studentETA.distanceMeters,
                  method: studentETA.method,
                }
              : locationData.eta,
            timestamp: locationData.timestamp || new Date().toISOString(),
          };

          try {
            conn.ws.send(JSON.stringify(message));
            sentCount++;
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`log_${Date.now()}_ws_broadcast_parent_sent`,timestamp:Date.now(),location:'socket/server.js:563',message:'Parent location update sent successfully',data:{connectionId,tripId,studentId:sub.studentId,parentId:sub.parentId},sessionId:'debug-session',runId:'ws-broadcast-parent-sent',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
          } catch (error) {
            failedSends++;
            console.error("Error sending trip location to parent:", error);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`log_${Date.now()}_ws_broadcast_parent_send_error`,timestamp:Date.now(),location:'socket/server.js:567',message:'Error sending trip location to parent',data:{connectionId,tripId,studentId:sub.studentId,error:error?.message},sessionId:'debug-session',runId:'ws-broadcast-parent-send-error',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
          }
        }
      } catch (error) {
        console.error("Error parsing parent subscription:", error);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`log_${Date.now()}_ws_broadcast_parent_parse_error`,timestamp:Date.now(),location:'socket/server.js:571',message:'Error parsing parent subscription',data:{connectionId,subStr,error:error?.message},sessionId:'debug-session',runId:'ws-broadcast-parent-parse-error',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
      }
    });
  });

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`log_${Date.now()}_ws_broadcast_to_parents_end`,timestamp:Date.now(),location:'socket/server.js:574',message:'WebSocket server completed broadcast to parents summary',data:{tripId,sentCount,checkedSubscriptions,matchingSubscriptions,failedSends,parentSubscriptionsCount},sessionId:'debug-session',runId:'ws-broadcast-to-parents-end',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  if (parentSubscriptionsCount === 0 || (checkedSubscriptions === 0 && matchingSubscriptions === 0)) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`log_${Date.now()}_ws_no_parents_notified`,timestamp:Date.now(),location:'socket/server.js:578',message:'WebSocket server found no parents to notify',data:{tripId,checkedSubscriptions,matchingSubscriptions,parentSubscriptionsCount},sessionId:'debug-session',runId:'ws-no-parents-notified',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
  }

  if (sentCount > 0) {
    console.log(
      `📡 [Parent Location] Broadcasted trip ${tripId} location to ${sentCount} parent(s)`
    );
  }
};

// Broadcast trip alert to all admin clients
const broadcastTripAlert = (alert) => {
  const message = {
    type: "tripAlert",
    ...alert,
  };

  broadcastToAdmins(message);
  console.log(
    `🚨 [Trip Alert] Broadcasted alert for trip ${alert.tripId}: ${alert.alertType}`
  );
};

// Broadcast driver locations to all admin clients
const broadcastToAdmins = (data) => {
  let adminCount = 0;
  let sentCount = 0;

  console.log(
    `📡 [broadcastToAdmins] Broadcasting ${data.type} to admin clients`
  );

  wss.clients.forEach((client) => {
    if (client.isAdmin) {
      adminCount++;
      if (client.readyState === 1) {
        // 1 = OPEN
        try {
          let dataToSend = data;

          // Filter by company if this is a COMPANY user
          if (client.companyId && client.companyDriverIds) {
            console.log(
              `🔍 [broadcastToAdmins] Filtering for company ${client.companyId} with ${client.companyDriverIds.length} drivers`
            );
            if (
              data.type === "driverLocations" ||
              data.type === "driverLocationUpdate"
            ) {
              if (data.type === "driverLocations") {
                dataToSend = {
                  ...data,
                  drivers: filterDriversByCompany(
                    data.drivers || {},
                    client.companyDriverIds
                  ),
                };
                console.log(
                  `🔍 [broadcastToAdmins] Filtered drivers: ${
                    Object.keys(dataToSend.drivers).length
                  } drivers`
                );
              } else if (data.type === "driverLocationUpdate") {
                // Only send if driver belongs to company
                if (!client.companyDriverIds.includes(data.driver?.id)) {
                  console.log(
                    `⏭️ [broadcastToAdmins] Skipping driver ${data.driver?.id} - not in company ${client.companyId}`
                  );
                  return; // Skip this update
                }
                console.log(
                  `✅ [broadcastToAdmins] Driver ${data.driver?.id} belongs to company ${client.companyId}`
                );
              }
            } else if (
              data.type === "activeRides" ||
              data.type === "activeRidesUpdate"
            ) {
              dataToSend = {
                ...data,
                rides: filterRidesByCompany(
                  data.rides || {},
                  client.companyDriverIds
                ),
              };
            }
          }

          client.send(JSON.stringify(dataToSend));
          sentCount++;
          console.log(
            `✅ [broadcastToAdmins] Sent ${data.type} to admin client`
          );
        } catch (error) {
          console.error(
            `❌ [broadcastToAdmins] Error sending to admin client:`,
            error
          );
        }
      } else {
        console.log(
          `⚠️ [broadcastToAdmins] Admin client not ready (state: ${client.readyState})`
        );
      }
    }
  });

  if (adminCount > 0) {
    console.log(
      `📡 [broadcastToAdmins] Broadcasted ${data.type} to ${sentCount}/${adminCount} admin clients`
    );
  } else {
    console.log(
      `⚠️ [broadcastToAdmins] No admin clients connected to receive ${data.type}`
    );
  }
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

// Helper function to update driver location and broadcast to dashboard
// This is used both by WebSocket messages and HTTP API calls
const updateDriverLocationAndBroadcast = async (driverId, locationData) => {
  const startTime = Date.now();
  const driverStatus = locationData.status || "active";
  const now = new Date().toISOString();

  try {
    const driverData = {
      id: driverId,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      bearing:
        locationData.heading !== null && locationData.heading !== undefined
          ? locationData.heading
          : null,
      name: locationData.name || "Driver",
      status: driverStatus,
      vehicleType: locationData.vehicleType || "Car",
      timestamp: now,
      lastSeen: now, // Track when driver last sent update for cleanup
    };

    // Store in Redis (with in-memory fallback)
    await driverStore.setDriver(driverId, driverData);

    // Also update in-memory for backward compatibility
    drivers[driverId] = driverData;

    console.log(
      `✅ [Location Update] Updated driver location: ID=${driverId}, Status=${driverStatus}, Lat=${locationData.latitude}, Lng=${locationData.longitude}, LastSeen=${now}`,
      {
        source: locationData.source || "unknown", // Can be "websocket" or "http"
        heading: locationData.heading ?? null,
        vehicleType: locationData.vehicleType || "Car",
      }
    );

    // Broadcast to all admin clients (dashboard)
    const updateMessage = {
      type: "driverLocationUpdate",
      driver: driverData,
    };

    broadcastToAdmins(updateMessage);

    // Publish to other instances via Pub/Sub
    if (pubsubManager && pubsubManager.enabled) {
      pubsubManager
        .publishLocationUpdate(driverId, locationData)
        .catch((error) => {
          console.error("Error publishing location update:", error);
        });
    }

    // Record metrics
    if (metricsCollector) {
      const latency = Date.now() - startTime;
      metricsCollector.recordUpdate(latency);
    }

    return driverData;
  } catch (error) {
    // Record error in metrics
    if (metricsCollector) {
      metricsCollector.recordError();
    }
    throw error;
  }
};

wss.on("connection", (ws, req) => {
  // Check if this is an admin connection (from dashboard)
  let isAdmin = false;
  let isParent = false;
  let parentId = null;
  let companyId = null;
  let companyDriverIds = null;

  try {
    // Parse URL to get query parameters
    const urlString = req.url || "";
    console.log(`🔍 New WebSocket connection - URL: ${urlString}`);
    console.log(`🔍 Request headers:`, {
      host: req.headers.host,
      origin: req.headers.origin,
    });

    // Parse URL - handle both absolute and relative URLs
    let url;
    try {
      // Try parsing as absolute URL first (for WebSocket URLs)
      if (urlString.startsWith("/")) {
        // Relative URL - construct full URL
        const protocol = req.headers["x-forwarded-proto"] || "http";
        const host = req.headers.host || "localhost:8080";
        url = new URL(urlString, `${protocol}://${host}`);
      } else {
        // Already absolute or just query string
        url = new URL(
          urlString,
          `http://${req.headers.host || "localhost:8080"}`
        );
      }
    } catch (parseError) {
      // Fallback: parse query string manually
      console.log("⚠️ URL parsing error, using fallback:", parseError.message);
      const queryString = urlString.includes("?")
        ? urlString.split("?")[1]
        : urlString;
      const params = new URLSearchParams(queryString);
      isAdmin = params.get("role") === "admin";
      isParent = params.get("role") === "parent";
      parentId = params.get("parentId");
      url = { searchParams: params }; // Create a mock URL object for consistency
    }

    isAdmin = url.searchParams.get("role") === "admin";
    isParent = url.searchParams.get("role") === "parent";
    parentId = url.searchParams.get("parentId") || null;

    // Try to get token from query params or Authorization header
    const token =
      url.searchParams.get("token") ||
      (req.headers.authorization &&
        req.headers.authorization.replace("Bearer ", ""));

    if (token && isAdmin) {
      try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        companyId = decoded.companyId || null;
        console.log(
          `🔍 Decoded token - role: ${decoded.role}, companyId: ${companyId}`
        );

        // If COMPANY user, fetch company driver IDs
        if (decoded.role === "COMPANY" && companyId) {
          // We'll fetch this from the database via HTTP request
          // For now, we'll set it up to be fetched asynchronously
          fetchCompanyDrivers(companyId)
            .then((driverIds) => {
              ws.companyDriverIds = driverIds;
              companyDriverIds = driverIds;
              console.log(
                `✅ Loaded ${driverIds.length} drivers for company ${companyId}`
              );
            })
            .catch((err) => {
              console.error(`❌ Error fetching company drivers:`, err);
            });
        }
      } catch (err) {
        console.log(`⚠️ Could not decode token:`, err.message);
      }
    }

    console.log(
      `🔍 Connection type: ${
        isAdmin ? "Admin (Dashboard)" : isParent ? "Parent" : "Driver/User"
      }, companyId: ${companyId}, parentId: ${parentId}`
    );
  } catch (error) {
    // Fallback: check if URL contains role=admin or role=parent
    if (req.url && req.url.includes("role=admin")) {
      isAdmin = true;
    }
    if (req.url && req.url.includes("role=parent")) {
      isParent = true;
    }
    console.log(
      `🔍 URL parsing fallback, isAdmin: ${isAdmin}, isParent: ${isParent}, URL: ${req.url}`
    );
  }

  ws.isAdmin = isAdmin;
  ws.isParent = isParent;
  ws.parentId = parentId;
  ws.companyId = companyId;
  ws.companyDriverIds = companyDriverIds;

  // Register connection with connection manager
  if (isAdmin) {
    connectionId = connectionManager.addConnection(ws, "admin", {
      companyId,
      companyDriverIds,
    });
  } else if (isParent) {
    connectionId = connectionManager.addConnection(ws, "parent", {
      parentId,
    });
  } else {
    // Will be updated when we know if it's a driver or user
    connectionId = connectionManager.addConnection(ws, "client", {});
  }

  // Log connection details
  const metrics = connectionManager.getMetrics();
  console.log(`📊 Current connections: ${wss.clients.size} total`);
  console.log(`📊 Connection manager:`, metrics);
  console.log(`📊 Current drivers in memory: ${Object.keys(drivers).length}`);

  // Set up ping/pong keepalive to prevent connection timeouts
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  // Handle WebSocket errors
  ws.on("error", (error) => {
    console.error(
      `❌ WebSocket error for ${isAdmin ? "admin" : "client"}:`,
      error.message || error
    );
  });

  if (isAdmin) {
    console.log("👤 Admin client connected");
    console.log(`📊 Current drivers in system: ${Object.keys(drivers).length}`);
    console.log(`📊 Current active rides: ${Object.keys(activeRides).length}`);

    // Send initial data after company drivers are loaded (if COMPANY user)
    const sendInitialData = async () => {
      // Load drivers from Redis/store
      const allDrivers = await driverStore.getAllDrivers();
      let driversToSend = allDrivers;
      let ridesToSend = activeRides;

      // Filter by company if COMPANY user
      if (
        ws.companyId &&
        ws.companyDriverIds &&
        ws.companyDriverIds.length > 0
      ) {
        driversToSend = filterDriversByCompany(allDrivers, ws.companyDriverIds);
        ridesToSend = filterRidesByCompany(activeRides, ws.companyDriverIds);
        console.log(
          `🔍 Filtered to ${Object.keys(driversToSend).length} drivers and ${
            Object.keys(ridesToSend).length
          } rides for company ${ws.companyId}`
        );
      }

      // Send current driver locations to new admin client
      const driverLocationsMessage = JSON.stringify({
        type: "driverLocations",
        drivers: driversToSend,
      });
      console.log(
        `📤 Sending initial driver locations (${
          Object.keys(driversToSend).length
        } drivers) to admin client`
      );
      ws.send(driverLocationsMessage);

      // Send active rides
      const activeRidesMessage = JSON.stringify({
        type: "activeRides",
        rides: ridesToSend,
      });
      console.log(
        `📤 Sending initial active rides (${
          Object.keys(ridesToSend).length
        } rides) to admin client`
      );
      ws.send(activeRidesMessage);
    };

    // If COMPANY user, wait for driver IDs to load, otherwise send immediately
    if (ws.companyId && !ws.companyDriverIds) {
      // Wait a bit for company drivers to load
      setTimeout(() => {
        sendInitialData();
      }, 500);
    } else {
      sendInitialData();
    }
  } else if (isParent) {
    console.log(`👨‍👩‍👧 Parent ${parentId || "unknown"} connected`);
    if (parentId) {
      ws.parentId = parentId;
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`log_${Date.now()}_ws_parent_connected`,timestamp:Date.now(),location:'socket/server.js:979',message:'Parent WebSocket connected',data:{parentId,connectionId,hasConnectionId:!!connectionId,isParent,readyState:ws.readyState},sessionId:'debug-session',runId:'ws-parent-connected',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
  } else {
    console.log("🔌 Client connected (driver or user)");
    // Try to get userId from query params
    try {
      const urlString = req.url || "";
      const url = new URL(
        urlString,
        `http://${req.headers.host || "localhost"}`
      );
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

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);
      console.log(
        `📨 Received message from ${ws.isAdmin ? "admin" : "client"}:`,
        data.type || "unknown"
      );

      // Handle ping/pong keep-alive messages
      if (data.type === "ping") {
        // Respond with pong to keep connection alive
        try {
          ws.send(JSON.stringify({ type: "pong" }));
          console.log("🏓 [WebSocket] Responded to ping with pong");
        } catch (error) {
          console.error("❌ [WebSocket] Error sending pong:", error);
        }
        return; // Don't process ping messages further
      }

      // Log driver location updates in detail
      if (data.type === "locationUpdate" && data.role === "driver") {
        console.log(
          `🚗 [WebSocket] Driver location update received from driver ID: ${data.driver}`
        );
        console.log(`🚗 [WebSocket] Location data:`, {
          latitude: data.data?.latitude,
          longitude: data.data?.longitude,
          heading: data.data?.heading,
          status: data.data?.status,
          name: data.data?.name,
          vehicleType: data.data?.vehicleType,
        });
      }

      if (data.type === "locationUpdate" && data.role === "driver") {
        // Store driver ID in the WebSocket connection for cleanup on disconnect
        ws.driverId = data.driver;

        const driverStatus = data.data.status || "active";

        console.log(
          `📝 [WebSocket] Processing location update for driver ${data.driver} with status: ${driverStatus}`
        );

        // Use helper function to update location and broadcast
        updateDriverLocationAndBroadcast(data.driver, {
          latitude: data.data.latitude,
          longitude: data.data.longitude,
          heading:
            data.data.heading !== null && data.data.heading !== undefined
              ? data.data.heading
              : null,
          name: data.data.name || "Driver",
          status: driverStatus,
          vehicleType: data.data.vehicleType || "Car",
        }).catch((error) => {
          console.error(`❌ Error updating driver location:`, error);
        });

        // Get driver count from store
        driverStore.getDriverCount().then((count) => {
          console.log(`📊 [WebSocket] Total drivers in system: ${count}`);
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
        driverStore.getDriverCount().then((count) => {
          console.log(`Total drivers in system: ${count}`);
        });
        findNearbyDrivers(data.latitude, data.longitude)
          .then((nearbyDrivers) => {
            console.log(`Found ${nearbyDrivers.length} nearby drivers`);
            if (nearbyDrivers.length > 0) {
              console.log(
                "Nearby drivers:",
                JSON.stringify(nearbyDrivers, null, 2)
              );
            }
            ws.send(
              JSON.stringify({ type: "nearbyDrivers", drivers: nearbyDrivers })
            );
          })
          .catch((error) => {
            console.error("Error finding nearby drivers:", error);
            ws.send(JSON.stringify({ type: "nearbyDrivers", drivers: [] }));
          });
      }

      // Handle user registration message
      if (data.type === "registerUser" && data.role === "user" && data.userId) {
        ws.userId = data.userId;
        userConnections[data.userId] = ws;

        // Update connection manager
        if (connectionId) {
          const conn = connectionManager.getConnection(connectionId);
          if (conn) {
            conn.type = "user";
            conn.metadata.userId = data.userId;
            connectionManager.userConnections.set(data.userId, connectionId);
          }
        }

        console.log(`👤 User ${data.userId} registered for updates`);
        ws.send(
          JSON.stringify({
            type: "registered",
            message: "User registered successfully",
          })
        );
      }

      if (data.type === "driverStatusChange" && data.role === "driver") {
        // Store driver ID in the WebSocket connection for cleanup on disconnect
        ws.driverId = data.driver;

        console.log(
          `🔄 [WebSocket] Driver status change received: driver=${data.driver}, status=${data.status}`
        );

        if (data.status === "inactive") {
          // Remove driver from available drivers when they go inactive
          console.log(
            `🔄 [WebSocket] Driver ${data.driver} went inactive - removing from available drivers`
          );
          await driverStore.removeDriver(data.driver);
          delete drivers[data.driver]; // Also remove from in-memory fallback
          driverStore.getDriverCount().then((count) => {
            console.log(
              `📊 [WebSocket] Total drivers in system after removal: ${count}`
            );
          });
          // Broadcast removal to admin clients
          broadcastToAdmins({
            type: "driverRemoved",
            driverId: data.driver,
          });
        } else if (data.status === "active") {
          console.log(
            `🔄 [WebSocket] Driver ${data.driver} went active - waiting for location update`
          );
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

      // Handle trip location updates
      if (data.type === "tripLocationUpdate" && data.role === "driver") {
        const { tripId, location, speed, deviationStatus, eta, studentStopETAs } = data;

        console.log(
          `📍 [WebSocket] Trip location update received: tripId=${tripId}, driver=${data.driver}`
        );

        const locationData = {
          driverId: data.driver,
          location,
          speed,
          deviationStatus,
          eta: eta || null,
          studentStopETAs: studentStopETAs || null,
          timestamp: new Date().toISOString(),
        };

        // Broadcast to subscribed admins
        broadcastTripLocationUpdate(tripId, locationData);

        // Broadcast to subscribed parents
        broadcastTripLocationToParents(tripId, locationData);
      }

      // Handle admin subscription to trips
      if (data.type === "subscribeToTrip" && ws.isAdmin) {
        const { tripId } = data;
        if (tripId && connectionId) {
          if (!adminTripSubscriptions.has(connectionId)) {
            adminTripSubscriptions.set(connectionId, new Set());
          }
          adminTripSubscriptions.get(connectionId).add(tripId);
          console.log(`📡 [WebSocket] Admin subscribed to trip ${tripId}`);
          ws.send(
            JSON.stringify({
              type: "tripSubscriptionConfirmed",
              tripId,
              message: "Subscribed to trip updates",
            })
          );
        }
      }

      // Handle admin unsubscribe from trips
      if (data.type === "unsubscribeFromTrip" && ws.isAdmin) {
        const { tripId } = data;
        if (
          tripId &&
          connectionId &&
          adminTripSubscriptions.has(connectionId)
        ) {
          adminTripSubscriptions.get(connectionId).delete(tripId);
          console.log(`📡 [WebSocket] Admin unsubscribed from trip ${tripId}`);
        }
      }

      // Handle parent subscription to trips
      if (data.type === "subscribeToTrip" && data.role === "parent") {
        const { tripId, studentId, parentId } = data;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`log_${Date.now()}_ws_parent_subscribe_received`,timestamp:Date.now(),location:'socket/server.js:1240',message:'Parent subscription message received',data:{tripId,studentId,parentId,hasConnectionId:!!connectionId,connectionId,isParent:ws.isParent,readyState:ws.readyState},sessionId:'debug-session',runId:'ws-parent-subscribe-received',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        if (tripId && studentId && parentId && connectionId) {
          if (!parentTripSubscriptions.has(connectionId)) {
            parentTripSubscriptions.set(connectionId, new Set());
          }
          const subscription = { tripId, studentId, parentId };
          parentTripSubscriptions.get(connectionId).add(JSON.stringify(subscription));
          const totalSubscriptions = parentTripSubscriptions.size;
          const subscriptionsForConnection = parentTripSubscriptions.get(connectionId).size;
          console.log(
            `📡 [WebSocket] Parent ${parentId} subscribed to trip ${tripId} for student ${studentId}`
          );
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`log_${Date.now()}_ws_parent_subscribe_success`,timestamp:Date.now(),location:'socket/server.js:1247',message:'Parent subscription successful',data:{tripId,studentId,parentId,connectionId,totalSubscriptions,subscriptionsForConnection},sessionId:'debug-session',runId:'ws-parent-subscribe-success',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          ws.send(
            JSON.stringify({
              type: "tripSubscriptionConfirmed",
              tripId,
              studentId,
              message: "Subscribed to trip updates",
            })
          );
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`log_${Date.now()}_ws_parent_subscribe_failed`,timestamp:Date.now(),location:'socket/server.js:1241',message:'Parent subscription failed - missing required fields',data:{tripId,studentId,parentId,hasConnectionId:!!connectionId,connectionId},sessionId:'debug-session',runId:'ws-parent-subscribe-failed',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
        }
      }

      // Handle parent unsubscribe from trips
      if (data.type === "unsubscribeFromTrip" && data.role === "parent") {
        const { tripId } = data;
        if (
          tripId &&
          connectionId &&
          parentTripSubscriptions.has(connectionId)
        ) {
          const subscriptions = parentTripSubscriptions.get(connectionId);
          // Remove all subscriptions for this trip
          const toRemove = [];
          subscriptions.forEach((sub) => {
            const parsed = JSON.parse(sub);
            if (parsed.tripId === tripId) {
              toRemove.push(sub);
            }
          });
          toRemove.forEach((sub) => subscriptions.delete(sub));
          console.log(
            `📡 [WebSocket] Parent unsubscribed from trip ${tripId}`
          );
        }
      }
    } catch (error) {
      console.log("Failed to parse WebSocket message:", error);
    }
  });

  ws.on("close", (code, reason) => {
    const reasonStr = reason ? reason.toString() : "No reason provided";

    // Remove from connection manager
    if (connectionId) {
      connectionManager.removeConnection(connectionId);
      // Clean up trip subscriptions
      adminTripSubscriptions.delete(connectionId);
      parentTripSubscriptions.delete(connectionId);
    }

    if (ws.isAdmin) {
      console.log(
        `👤 Admin client disconnected: code=${code}, reason="${reasonStr}"`
      );
    } else if (ws.driverId) {
      // If a driver disconnects, don't immediately remove them
      // They may still be online and sending HTTP API updates
      // The cleanup interval will remove them if they're truly offline (no updates for 10+ minutes)
      console.log(
        `🚗 Driver ${ws.driverId} disconnected: code=${code}, reason="${reasonStr}" - keeping in memory (will be removed by cleanup if truly offline)`
      );
      // Mark lastSeen timestamp if driver exists and doesn't have one
      if (drivers[ws.driverId] && !drivers[ws.driverId].lastSeen) {
        drivers[ws.driverId].lastSeen = new Date().toISOString();
      }
      // Don't remove driver or broadcast removal - allows HTTP API updates to keep them visible
    } else if (ws.userId) {
      // If a user disconnects, remove them from user connections
      console.log(
        `👤 User ${ws.userId} disconnected: code=${code}, reason="${reasonStr}"`
      );
      delete userConnections[ws.userId];
    } else {
      console.log(
        `🔌 Client disconnected: code=${code}, reason="${reasonStr}"`
      );
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
      console.log(
        `💀 Terminating dead connection (${ws.isAdmin ? "admin" : "client"})`
      );
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

// Cleanup stale drivers that haven't sent updates for extended period
// Runs every 1 minute to remove drivers with lastSeen older than 5 minutes
// Note: Redis TTL handles expiration automatically, but we still check in-memory fallback
const CLEANUP_INTERVAL = 60000; // 1 minute - more frequent cleanup checks
const STALE_DRIVER_THRESHOLD = 300000; // 5 minutes in milliseconds - provides buffer for temporary update gaps

setInterval(async () => {
  const now = Date.now();
  const staleDriverIds = [];

  // Get all drivers from store
  const allDrivers = await driverStore.getAllDrivers();

  // Check all drivers for stale lastSeen timestamps
  Object.entries(allDrivers).forEach(([driverId, driver]) => {
    if (driver.lastSeen) {
      const lastSeenTime = new Date(driver.lastSeen).getTime();
      const timeSinceLastSeen = now - lastSeenTime;

      if (timeSinceLastSeen > STALE_DRIVER_THRESHOLD) {
        staleDriverIds.push(driverId);
      }
    } else {
      // If driver doesn't have lastSeen, consider it stale (older implementation)
      // But give it a chance - only remove if it's been more than 10 minutes since timestamp
      if (driver.timestamp) {
        const timestampTime = new Date(driver.timestamp).getTime();
        const timeSinceTimestamp = now - timestampTime;

        if (timeSinceTimestamp > STALE_DRIVER_THRESHOLD) {
          staleDriverIds.push(driverId);
        }
      } else {
        // No timestamp at all - mark as stale
        staleDriverIds.push(driverId);
      }
    }
  });

  // Remove stale drivers and broadcast removal
  for (const driverId of staleDriverIds) {
    console.log(
      `🧹 Removing stale driver ${driverId} - no updates received for more than 5 minutes`
    );
    await driverStore.removeDriver(driverId);
    delete drivers[driverId]; // Also remove from in-memory fallback
    broadcastToAdmins({
      type: "driverRemoved",
      driverId: driverId,
    });
  }

  if (staleDriverIds.length > 0) {
    console.log(
      `🧹 Cleanup completed: removed ${staleDriverIds.length} stale driver(s)`
    );
  }
}, CLEANUP_INTERVAL);

const findNearbyDrivers = async (userLat, userLon) => {
  console.log(`🔍 Finding nearby drivers for location: ${userLat}, ${userLon}`);

  // Get all drivers from store
  const allDrivers = await driverStore.getAllDrivers();
  console.log(`📊 Total drivers registered: ${Object.keys(allDrivers).length}`);

  const nearbyDrivers = Object.entries(allDrivers)
    .filter(([id, driver]) => {
      console.log(`\n🚗 Checking driver ${id}:`);
      console.log(
        `   Status: "${driver.status}" (type: ${typeof driver.status})`
      );
      console.log(`   Location: ${driver.latitude}, ${driver.longitude}`);

      // Only include active drivers - check status with flexible comparison
      const isActive =
        driver.status === "active" ||
        driver.status === "Active" ||
        String(driver.status).toLowerCase() === "active";

      if (!isActive) {
        console.log(
          `   ❌ Driver ${id} is not active (status: "${driver.status}") - excluding`
        );
        return false;
      }

      // Check distance (within 5 kilometers)
      const distance = geolib.getDistance(
        { latitude: userLat, longitude: userLon },
        { latitude: driver.latitude, longitude: driver.longitude }
      );
      const isWithinRange = distance <= 5000; // 5 kilometers

      if (!isWithinRange) {
        console.log(
          `   ❌ Driver ${id} is too far away (${distance}m = ${(
            distance / 1000
          ).toFixed(2)}km) - excluding`
        );
      } else {
        console.log(
          `   ✅ Driver ${id} is within range (${distance}m = ${(
            distance / 1000
          ).toFixed(2)}km)`
        );
      }

      return isWithinRange;
    })
    .map(([id, driver]) => ({ id, ...driver }));

  console.log(
    `\n✅ Total nearby active drivers found: ${nearbyDrivers.length}`
  );
  return nearbyDrivers;
};

// API endpoint to get current driver locations (for HTTP requests)
app.get("/api/drivers", async (req, res) => {
  try {
    const allDrivers = await driverStore.getAllDrivers();
    const driverCount = Object.keys(allDrivers).length;
    console.log(
      `📡 HTTP API: /api/drivers requested - returning ${driverCount} drivers`
    );
    res.json({
      drivers: allDrivers,
      count: driverCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting drivers:", error);
    res.status(500).json({
      drivers: {},
      count: 0,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// API endpoint to get active rides
app.get("/api/active-rides", (req, res) => {
  const rideCount = Object.keys(activeRides).length;
  console.log(
    `📡 HTTP API: /api/active-rides requested - returning ${rideCount} rides`
  );
  res.json({
    rides: activeRides,
    count: rideCount,
    timestamp: new Date().toISOString(),
  });
});

// API endpoint to get connection stats (for debugging)
app.get("/api/stats", (req, res) => {
  const adminClients = Array.from(wss.clients).filter(
    (client) => client.isAdmin
  ).length;
  const totalClients = wss.clients.size;
  const driverCount = Object.keys(drivers).length;

  console.log(`📡 HTTP API: /api/stats requested`);
  res.json({
    connections: {
      total: totalClients,
      admin: adminClients,
      drivers: totalClients - adminClients,
    },
    drivers: {
      count: driverCount,
      ids: Object.keys(drivers),
    },
    activeRides: {
      count: Object.keys(activeRides).length,
    },
    redis: {
      enabled: ENABLE_REDIS,
      connected: redis ? redis.status === "ready" : false,
    },
    connections: connectionManager.getMetrics(),
    timestamp: new Date().toISOString(),
  });
});

// API endpoint for Redis health check
app.get("/api/health/redis", async (req, res) => {
  if (!ENABLE_REDIS || !redis) {
    return res.json({
      status: "disabled",
      message: "Redis is disabled",
    });
  }

  try {
    // Test Redis connection with PING
    const result = await redis.ping();
    const info = await redis.info("server");

    res.json({
      status: "healthy",
      connected: redis.status === "ready",
      ping: result,
      info: {
        redis_version: info.match(/redis_version:([^\r\n]+)/)?.[1] || "unknown",
        uptime: info.match(/uptime_in_seconds:([^\r\n]+)/)?.[1] || "unknown",
      },
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error.message,
    });
  }
});

// API endpoint for metrics
app.get("/api/metrics", async (req, res) => {
  if (!ENABLE_METRICS || !metricsCollector) {
    return res.json({
      status: "disabled",
      message: "Metrics collection is disabled",
    });
  }

  try {
    const metrics = metricsCollector.getMetrics();
    const adminClients = Array.from(wss.clients).filter(
      (client) => client.isAdmin
    ).length;
    const driverCount = await driverStore.getDriverCount();

    res.json({
      ...metrics,
      activeDrivers: driverCount,
      connectedAdmins: adminClients,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

// Log metrics every 60 seconds
if (ENABLE_METRICS && metricsCollector) {
  setInterval(() => {
    const metrics = metricsCollector.getMetrics();
    const adminClients = Array.from(wss.clients).filter(
      (client) => client.isAdmin
    ).length;
    driverStore.getDriverCount().then((driverCount) => {
      console.log("📊 [Metrics]", {
        updatesPerSecond: metrics.updatesPerSecond,
        averageLatency: `${metrics.averageLatency}ms`,
        errorRate: `${metrics.errorRate}%`,
        activeDrivers: driverCount,
        connectedAdmins: adminClients,
        totalUpdates: metrics.totalUpdates,
        totalErrors: metrics.totalErrors,
      });
    });
  }, 60000); // Every 60 seconds
}

// Note: Active trips list will be updated when trips become active
// and broadcasted via the trip location update mechanism

// API endpoint to notify user when ride is accepted (called from backend server)
app.post("/api/notify-ride-accepted", (req, res) => {
  try {
    const { userId, rideData } = req.body;

    if (!userId || !rideData) {
      return res
        .status(400)
        .json({ success: false, message: "userId and rideData are required" });
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
      message: sent
        ? "Notification sent to user"
        : "User not connected, will receive push notification",
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
      return res
        .status(400)
        .json({ success: false, message: "userId and rideId are required" });
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
      message: sent ? "Notification sent to user" : "User not connected",
    });
  } catch (error) {
    console.error("Error notifying user about ride completion:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API endpoint to update driver location (called from backend server when app is in background)
app.post("/api/update-driver-location", async (req, res) => {
  try {
    const {
      driverId,
      latitude,
      longitude,
      heading,
      name,
      status,
      vehicleType,
    } = req.body;

    if (!driverId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: "driverId, latitude, and longitude are required",
      });
    }

    console.log(
      `📡 [HTTP API] Location update received for driver ${driverId} (background/HTTP update)`,
      {
        latitude,
        longitude,
        heading: heading !== undefined ? heading : null,
        name: name || "Driver",
        status: status || "active",
        vehicleType: vehicleType || "Car",
        timestamp: new Date().toISOString(),
      }
    );

    // Update driver location and broadcast to dashboard
    // This ensures driver location is visible on dashboard even when WebSocket
    // connection is closed (which happens when app is in background)
    try {
      const updatedDriver = await updateDriverLocationAndBroadcast(driverId, {
        latitude,
        longitude,
        heading: heading !== undefined ? heading : null,
        name: name || "Driver",
        status: status || "active",
        vehicleType: vehicleType || "Car",
      });

      console.log(
        `✅ [HTTP API] Driver ${driverId} location updated and broadcasted to dashboard (lastSeen: ${updatedDriver.lastSeen})`
      );

      res.json({
        success: true,
        driver: updatedDriver,
        message: "Driver location updated and broadcasted to dashboard",
      });
    } catch (error) {
      console.error(`❌ [HTTP API] Error updating driver location:`, {
        driverId,
        error: error.message,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update driver location",
      });
    }
  } catch (error) {
    console.error("Error updating driver location via HTTP API:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API endpoint to broadcast trip location update (called from backend server)
app.post("/api/trip-location-update", (req, res) => {
  try {
    const { tripId, driverId, location, speed, deviationStatus, eta, studentStopETAs } =
      req.body;

    if (!tripId || !driverId || !location) {
      return res.status(400).json({
        success: false,
        message: "tripId, driverId, and location are required",
      });
    }

    console.log(
      `📍 [HTTP API] Trip location update received for trip ${tripId}${
        eta ? ` with ETA: ${eta.minutes} min` : ""
      }${studentStopETAs ? ` with ${studentStopETAs.length} student stop ETAs` : ""}`
    );

    // #region agent log
    const parentSubscriptionsCount = parentTripSubscriptions.size;
    const totalConnections = wss.clients.size;
    const parentConnections = Array.from(wss.clients).filter(ws => ws.isParent).length;
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`log_${Date.now()}_ws_receive_post`,timestamp:Date.now(),location:'socket/server.js:1766',message:'WebSocket server received POST /api/trip-location-update',data:{tripId,driverId,hasLocation:!!location,location:{latitude:location?.latitude,longitude:location?.longitude,heading:location?.heading},speed,hasEta:!!eta,studentStopETAsCount:studentStopETAs?.length || 0,parentSubscriptionsCount,totalConnections,parentConnections},sessionId:'debug-session',runId:'ws-receive-post',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    const locationData = {
      driverId,
      location,
      speed,
      deviationStatus,
      eta: eta || null,
      studentStopETAs: studentStopETAs || null,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to subscribed admins
    broadcastTripLocationUpdate(tripId, locationData);

    // Broadcast to subscribed parents
    broadcastTripLocationToParents(tripId, locationData);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/15d349b5-0eed-440d-a9fa-cb46d2b9ba51',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`log_${Date.now()}_ws_broadcast_complete`,timestamp:Date.now(),location:'socket/server.js:1798',message:'WebSocket server completed broadcast to parents',data:{tripId,driverId,parentSubscriptionsCount},sessionId:'debug-session',runId:'ws-broadcast-complete',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    res.json({
      success: true,
      message: "Trip location update broadcasted",
    });
  } catch (error) {
    console.error("Error broadcasting trip location update:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API endpoint to broadcast trip alert (called from backend server)
app.post("/api/trip-alert", (req, res) => {
  try {
    const alert = req.body;

    if (!alert.tripId || !alert.alertType) {
      return res.status(400).json({
        success: false,
        message: "tripId and alertType are required",
      });
    }

    console.log(
      `🚨 [HTTP API] Trip alert received: tripId=${alert.tripId}, type=${alert.alertType}`
    );

    // Broadcast to all admins
    broadcastTripAlert(alert);

    res.json({
      success: true,
      message: "Trip alert broadcasted",
    });
  } catch (error) {
    console.error("Error broadcasting trip alert:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API endpoint to notify admins about document upload/update (called from backend server)
app.post("/api/notify-document-upload", (req, res) => {
  try {
    const { notification } = req.body;

    if (!notification) {
      return res.status(400).json({
        success: false,
        message: "notification is required",
      });
    }

    console.log(
      `📄 [HTTP API] Document notification received for driver ${notification.driverId}`
    );
    console.log("📄 Notification data:", JSON.stringify(notification, null, 2));

    // Broadcast to all admin clients
    const broadcastData = {
      type: "documentNotification",
      notification: notification,
    };

    console.log(
      "📡 Broadcasting to admins:",
      JSON.stringify(broadcastData, null, 2)
    );
    broadcastToAdmins(broadcastData);

    res.json({
      success: true,
      message: "Document notification broadcasted to admins",
    });
  } catch (error) {
    console.error("Error broadcasting document notification:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Load drivers from Redis on startup
const loadDriversOnStartup = async () => {
  try {
    const loadedDrivers = await driverStore.getAllDrivers();
    console.log(
      `✅ Loaded ${
        Object.keys(loadedDrivers).length
      } drivers from Redis/store on startup`
    );
    // Also sync to in-memory fallback
    Object.assign(drivers, loadedDrivers);
  } catch (error) {
    console.error("❌ Error loading drivers on startup:", error);
  }
};

// Start the HTTP server (WebSocket is attached to it)
server
  .listen(PORT, async () => {
    console.log(`🚀 Server started on port ${PORT}`);
    console.log(`✅ HTTP API server is running`);
    console.log(`✅ WebSocket server is ready`);
    console.log(`\n📡 Connect WebSocket to: ws://localhost:${PORT}?role=admin`);
    console.log(`🌐 HTTP API available at: http://localhost:${PORT}/api\n`);

    // Load drivers from Redis/store on startup
    await loadDriversOnStartup();
  })
  .on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`❌ Port ${PORT} is already in use!`);
      console.error(
        `   Please stop the existing server or use a different port.`
      );
      process.exit(1);
    } else {
      console.error("Server error:", error);
      throw error;
    }
  });
