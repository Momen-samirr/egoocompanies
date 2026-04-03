function createMessageRouter({
  state,
  connectionManager,
  driverStore,
  services,
  debugIngest,
}) {
  async function handlePing(ws) {
    ws.send(JSON.stringify({ type: "pong" }));
  }

  async function handleLocationUpdate(ws, data) {
    if (data.role !== "driver") return;
    ws.driverId = data.driver;

    await services.driver.updateDriverLocationAndBroadcast(data.driver, {
      latitude: data.data.latitude,
      longitude: data.data.longitude,
      heading:
        data.data.heading !== null && data.data.heading !== undefined
          ? data.data.heading
          : null,
      name: data.data.name || "Driver",
      status: data.data.status || "active",
      vehicleType: data.data.vehicleType || "Car",
      source: "websocket",
    });
  }

  async function handleRequestRide(ws, data) {
    if (data.role !== "user") return;
    if (data.userId) {
      ws.userId = data.userId;
      state.userConnections[data.userId] = ws;
    }

    try {
      const nearbyDrivers = await services.driver.findNearbyDrivers(
        data.latitude,
        data.longitude
      );
      ws.send(JSON.stringify({ type: "nearbyDrivers", drivers: nearbyDrivers }));
    } catch (_error) {
      ws.send(JSON.stringify({ type: "nearbyDrivers", drivers: [] }));
    }
  }

  async function handleRegisterUser(ws, data, connectionId) {
    if (data.role !== "user" || !data.userId) return;
    ws.userId = data.userId;
    state.userConnections[data.userId] = ws;

    if (connectionId) {
      const conn = connectionManager.getConnection(connectionId);
      if (conn) {
        conn.type = "user";
        conn.metadata.userId = data.userId;
        connectionManager.userConnections.set(data.userId, connectionId);
      }
    }

    ws.send(
      JSON.stringify({
        type: "registered",
        message: "User registered successfully",
      })
    );
  }

  async function handleDriverStatusChange(ws, data) {
    if (data.role !== "driver") return;
    ws.driverId = data.driver;
    if (data.status === "inactive") {
      await services.driver.removeDriver(data.driver);
    }
  }

  async function handleRideStatusUpdate(_ws, data) {
    services.ride.upsertRideStatus(data);
  }

  async function handleTripLocationUpdate(_ws, data) {
    if (data.role !== "driver") return;
    const { tripId, location, speed, deviationStatus, eta, studentStopETAs } = data;
    const locationData = {
      driverId: data.driver,
      location,
      speed,
      deviationStatus,
      eta: eta || null,
      studentStopETAs: studentStopETAs || null,
      timestamp: new Date().toISOString(),
    };

    services.subscription.broadcastTripLocation(tripId, locationData);
  }

  async function handleSubscribeToTrip(ws, data, connectionId) {
    if (ws.isAdmin) {
      const subscribed = services.subscription.subscribeAdminToTrip(
        connectionId,
        data.tripId
      );
      if (subscribed) {
        ws.send(
          JSON.stringify({
            type: "tripSubscriptionConfirmed",
            tripId: data.tripId,
            message: "Subscribed to trip updates",
          })
        );
      }
      return;
    }

    if (data.role !== "parent") return;

    const immediateUpdate = await services.subscription.subscribeParentToTrip(
      connectionId,
      data
    );

    ws.send(
      JSON.stringify({
        type: "tripSubscriptionConfirmed",
        tripId: data.tripId,
        studentId: data.studentId,
        message: "Subscribed to trip updates",
      })
    );

    if (immediateUpdate && ws.readyState === 1) {
      ws.send(JSON.stringify(immediateUpdate));
    }
  }

  async function handleUnsubscribeFromTrip(ws, data, connectionId) {
    if (ws.isAdmin) {
      services.subscription.unsubscribeAdminFromTrip(connectionId, data.tripId);
      return;
    }
    if (data.role !== "parent") return;
    services.subscription.unsubscribeParentFromTrip(connectionId, data.tripId);
  }

  const handlers = {
    ping: handlePing,
    locationUpdate: handleLocationUpdate,
    requestRide: handleRequestRide,
    registerUser: handleRegisterUser,
    driverStatusChange: handleDriverStatusChange,
    rideStatusUpdate: handleRideStatusUpdate,
    tripLocationUpdate: handleTripLocationUpdate,
    subscribeToTrip: handleSubscribeToTrip,
    unsubscribeFromTrip: handleUnsubscribeFromTrip,
  };

  async function onMessage(ws, rawMessage, connectionId) {
    try {
      const data = JSON.parse(rawMessage);
      const handler = handlers[data.type];
      if (!handler) return;
      await handler(ws, data, connectionId);
    } catch (error) {
      console.log("Failed to parse WebSocket message:", error);
      debugIngest("ws_message_parse_error", "Failed to parse WS message", {
        error: error.message,
      });
    }
  }

  return {
    onMessage,
  };
}

module.exports = {
  createMessageRouter,
};
