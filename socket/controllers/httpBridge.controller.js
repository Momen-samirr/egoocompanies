function createHttpBridgeController({
  env,
  redis,
  driverStore,
  connectionManager,
  wss,
  state,
  services,
}) {
  async function getDrivers(_req, res) {
    try {
      const allDrivers = await driverStore.getAllDrivers();
      res.json({
        drivers: allDrivers,
        count: Object.keys(allDrivers).length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        drivers: {},
        count: 0,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  function getActiveRides(_req, res) {
    res.json({
      rides: state.activeRides,
      count: Object.keys(state.activeRides).length,
      timestamp: new Date().toISOString(),
    });
  }

  function getStats(_req, res) {
    const adminClients = Array.from(wss.clients).filter((client) => client.isAdmin)
      .length;
    const totalClients = wss.clients.size;

    res.json({
      socketConnections: {
        total: totalClients,
        admin: adminClients,
        drivers: totalClients - adminClients,
      },
      drivers: {
        count: Object.keys(state.drivers).length,
        ids: Object.keys(state.drivers),
      },
      activeRides: {
        count: Object.keys(state.activeRides).length,
      },
      redis: {
        enabled: env.enableRedis,
        connected: redis ? redis.status === "ready" : false,
      },
      connections: connectionManager.getMetrics(),
      timestamp: new Date().toISOString(),
    });
  }

  async function getRedisHealth(_req, res) {
    if (!env.enableRedis || !redis) {
      res.json({ status: "disabled", message: "Redis is disabled" });
      return;
    }

    try {
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
      res.status(503).json({ status: "unhealthy", error: error.message });
    }
  }

  async function getMetrics(_req, res) {
    if (!env.enableMetrics || !services.metrics) {
      res.json({ status: "disabled", message: "Metrics collection is disabled" });
      return;
    }

    try {
      const metrics = services.metrics.getMetrics();
      const adminClients = Array.from(wss.clients).filter((client) => client.isAdmin)
        .length;
      const driverCount = await driverStore.getDriverCount();
      res.json({
        ...metrics,
        activeDrivers: driverCount,
        connectedAdmins: adminClients,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  function notifyRideAccepted(req, res) {
    const { userId, rideData } = req.body;
    if (!userId || !rideData) {
      res
        .status(400)
        .json({ success: false, message: "userId and rideData are required" });
      return;
    }
    const delivered = services.broadcast.sendToUser(
      userId,
      { type: "rideAccepted", rideData },
      state
    );
    res.json({
      success: true,
      delivered,
      message: delivered
        ? "Notification sent to user"
        : "User not connected, will receive push notification",
    });
  }

  function notifyRideCompleted(req, res) {
    const { userId, rideId, rideData } = req.body;
    if (!userId || !rideId) {
      res
        .status(400)
        .json({ success: false, message: "userId and rideId are required" });
      return;
    }
    const delivered = services.broadcast.sendToUser(
      userId,
      { type: "rideCompleted", rideId, rideData },
      state
    );
    res.json({
      success: true,
      delivered,
      message: delivered ? "Notification sent to user" : "User not connected",
    });
  }

  async function updateDriverLocation(req, res) {
    const { driverId, latitude, longitude, heading, name, status, vehicleType } =
      req.body;
    if (!driverId || latitude === undefined || longitude === undefined) {
      res.status(400).json({
        success: false,
        message: "driverId, latitude, and longitude are required",
      });
      return;
    }

    try {
      const updatedDriver = await services.driver.updateDriverLocationAndBroadcast(
        driverId,
        {
          latitude,
          longitude,
          heading: heading !== undefined ? heading : null,
          name: name || "Driver",
          status: status || "active",
          vehicleType: vehicleType || "Car",
          source: "http",
        }
      );

      res.json({
        success: true,
        driver: updatedDriver,
        message: "Driver location updated and broadcasted to dashboard",
      });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: error.message || "Failed to update" });
    }
  }

  function tripLocationUpdate(req, res) {
    const { tripId, driverId, location, speed, deviationStatus, eta, studentStopETAs } =
      req.body;
    if (!tripId || !driverId || !location) {
      res.status(400).json({
        success: false,
        message: "tripId, driverId, and location are required",
      });
      return;
    }

    services.subscription.broadcastTripLocation(tripId, {
      driverId,
      location,
      speed,
      deviationStatus,
      eta: eta || null,
      studentStopETAs: studentStopETAs || null,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: "Trip location update broadcasted" });
  }

  function tripAlert(req, res) {
    const alert = req.body;
    if (!alert.tripId || !alert.alertType) {
      res
        .status(400)
        .json({ success: false, message: "tripId and alertType are required" });
      return;
    }
    services.broadcast.broadcastTripAlert(alert);
    res.json({ success: true, message: "Trip alert broadcasted" });
  }

  function notifyDocumentUpload(req, res) {
    const { notification } = req.body;
    if (!notification) {
      res.status(400).json({ success: false, message: "notification is required" });
      return;
    }
    services.broadcast.broadcastToAdmins({
      type: "documentNotification",
      notification,
    });
    res.json({
      success: true,
      message: "Document notification broadcasted to admins",
    });
  }

  return {
    getDrivers,
    getActiveRides,
    getStats,
    getRedisHealth,
    getMetrics,
    notifyRideAccepted,
    notifyRideCompleted,
    updateDriverLocation,
    tripLocationUpdate,
    tripAlert,
    notifyDocumentUpload,
  };
}

module.exports = {
  createHttpBridgeController,
};
