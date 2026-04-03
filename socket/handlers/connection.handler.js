const jwt = require("jsonwebtoken");

function createVerifyClient(env) {
  return function verifyClient(info) {
    const origin = info.origin;
    const req = info.req;

    console.log(
      `🔍 WebSocket connection attempt from origin: ${origin || "none"}`
    );
    console.log(`🔍 Request URL: ${req.url}`);

    if (!origin) return true;
    if (env.nodeEnv !== "production") return true;

    const isAllowed = env.allowedOrigins.some((allowedOrigin) => {
      if (origin === allowedOrigin) return true;
      if (origin.startsWith(allowedOrigin)) return true;
      const allowedDomain = allowedOrigin
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "");
      return origin.includes(allowedDomain);
    });

    if (!isAllowed) {
      console.log(`❌ WebSocket connection rejected from origin: ${origin}`);
      console.log("⚠️ Allowing connection for now - compatibility mode");
      return true;
    }
    return isAllowed;
  };
}

function createConnectionHandler({
  env,
  state,
  connectionManager,
  driverStore,
  services,
  backendApiClient,
  messageRouter,
  debugIngest,
}) {
  function parseConnectionContext(req) {
    let isAdmin = false;
    let isParent = false;
    let parentId = null;
    let companyId = null;
    let companyDriverIds = null;

    try {
      const urlString = req.url || "";
      let url;
      if (urlString.startsWith("/")) {
        const protocol = req.headers["x-forwarded-proto"] || "http";
        const host = req.headers.host || "localhost:8080";
        url = new URL(urlString, `${protocol}://${host}`);
      } else {
        url = new URL(urlString, `http://${req.headers.host || "localhost:8080"}`);
      }

      isAdmin = url.searchParams.get("role") === "admin";
      isParent = url.searchParams.get("role") === "parent";
      parentId = url.searchParams.get("parentId") || null;

      const token =
        url.searchParams.get("token") ||
        (req.headers.authorization || "").replace("Bearer ", "");
      if (token && isAdmin && env.accessTokenSecret) {
        try {
          const decoded = jwt.verify(token, env.accessTokenSecret);
          companyId = decoded.companyId || null;
          if (decoded.role === "COMPANY" && companyId) {
            backendApiClient.fetchCompanyDrivers(companyId).then((driverIds) => {
              companyDriverIds = driverIds;
            });
          }
        } catch (error) {
          console.log("⚠️ Could not decode token:", error.message);
        }
      }
    } catch (_error) {
      isAdmin = Boolean(req.url && req.url.includes("role=admin"));
      isParent = Boolean(req.url && req.url.includes("role=parent"));
    }

    return {
      isAdmin,
      isParent,
      parentId,
      companyId,
      companyDriverIds,
    };
  }

  async function sendInitialAdminData(ws) {
    const allDrivers = await driverStore.getAllDrivers();
    let driversToSend = allDrivers;
    let ridesToSend = state.activeRides;

    if (ws.companyId && ws.companyDriverIds && ws.companyDriverIds.length > 0) {
      driversToSend = services.broadcast.filterDriversByCompany(
        allDrivers,
        ws.companyDriverIds
      );
      ridesToSend = services.broadcast.filterRidesByCompany(
        state.activeRides,
        ws.companyDriverIds
      );
    }

    ws.send(
      JSON.stringify({
        type: "driverLocations",
        drivers: driversToSend,
      })
    );
    ws.send(
      JSON.stringify({
        type: "activeRides",
        rides: ridesToSend,
      })
    );
  }

  return function onConnection(ws, req) {
    const context = parseConnectionContext(req);

    ws.isAdmin = context.isAdmin;
    ws.isParent = context.isParent;
    ws.parentId = context.parentId;
    ws.companyId = context.companyId;
    ws.companyDriverIds = context.companyDriverIds;

    if (ws.companyId && !ws.companyDriverIds) {
      backendApiClient
        .fetchCompanyDrivers(ws.companyId)
        .then((driverIds) => {
          ws.companyDriverIds = driverIds;
        })
        .catch((error) => {
          console.error("❌ Error fetching company drivers:", error);
        });
    }

    let connectionId;
    if (ws.isAdmin) {
      connectionId = connectionManager.addConnection(ws, "admin", {
        companyId: ws.companyId,
        companyDriverIds: ws.companyDriverIds,
      });
    } else if (ws.isParent) {
      connectionId = connectionManager.addConnection(ws, "parent", {
        parentId: ws.parentId,
      });
    } else {
      connectionId = connectionManager.addConnection(ws, "client", {});
    }

    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("error", (error) => {
      console.error("❌ WebSocket error:", error.message || error);
    });

    if (ws.isAdmin) {
      if (ws.companyId && !ws.companyDriverIds) {
        setTimeout(() => sendInitialAdminData(ws), 500);
      } else {
        sendInitialAdminData(ws);
      }
    } else if (ws.isParent) {
      ws._connectionId = connectionId;
      debugIngest("ws_parent_connected", "Parent WebSocket connected", {
        parentId: ws.parentId,
        connectionId,
      });
    } else {
      try {
        const urlString = req.url || "";
        const url = new URL(
          urlString,
          `http://${req.headers.host || "localhost:8080"}`
        );
        const userId = url.searchParams.get("userId");
        if (userId) {
          ws.userId = userId;
          state.userConnections[userId] = ws;
        }
      } catch (_error) {
        // Ignore URL parse errors for optional user id.
      }
    }

    ws.on("message", (message) => messageRouter.onMessage(ws, message, connectionId));

    ws.on("close", (code, reason) => {
      const reasonStr = reason ? reason.toString() : "No reason provided";
      debugIngest("ws_connection_close", "WebSocket connection close event", {
        connectionId,
        code,
        reason: reasonStr,
      });

      if (connectionId) {
        connectionManager.removeConnection(connectionId);
        services.subscription.cleanupConnectionSubscriptions(connectionId);
      }

      if (ws.userId) {
        delete state.userConnections[ws.userId];
      }
      if (ws.driverId && state.drivers[ws.driverId] && !state.drivers[ws.driverId].lastSeen) {
        state.drivers[ws.driverId].lastSeen = new Date().toISOString();
      }
    });
  };
}

module.exports = {
  createVerifyClient,
  createConnectionHandler,
};
