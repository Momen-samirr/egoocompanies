function createBroadcastService({
  wss,
  connectionManager,
  subscriptionsState,
  debugIngest,
}) {
  function filterDriversByCompany(driversObj, companyDriverIds) {
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
  }

  function filterRidesByCompany(ridesObj, companyDriverIds) {
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
  }

  function broadcastToAdmins(data) {
    let adminCount = 0;
    let sentCount = 0;

    wss.clients.forEach((client) => {
      if (!client.isAdmin) return;
      adminCount += 1;

      if (client.readyState !== 1) return;

      try {
        let dataToSend = data;
        if (client.companyId && client.companyDriverIds) {
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
            } else if (!client.companyDriverIds.includes(data.driver?.id)) {
              return;
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
        sentCount += 1;
      } catch (error) {
        console.error("❌ [broadcastToAdmins] Error sending to admin:", error);
      }
    });

    if (adminCount > 0) {
      console.log(
        `📡 [broadcastToAdmins] Broadcasted ${data.type} to ${sentCount}/${adminCount} admin clients`
      );
    }
  }

  function broadcastTripLocationUpdate(tripId, locationData) {
    let sentCount = 0;
    const message = {
      type: "tripLocationUpdate",
      tripId,
      ...locationData,
      eta: locationData.eta || null,
    };

    wss.clients.forEach((client) => {
      if (!client.isAdmin) return;

      const clientConnectionId = Array.from(
        connectionManager.connections.entries()
      ).find(([, conn]) => conn.ws === client)?.[0];

      const subscriptions = clientConnectionId
        ? subscriptionsState.adminTripSubscriptions.get(clientConnectionId)
        : null;

      const shouldSend =
        !subscriptions ||
        subscriptions.size === 0 ||
        subscriptions.has(tripId);

      if (shouldSend && client.readyState === 1) {
        try {
          client.send(JSON.stringify(message));
          sentCount += 1;
        } catch (error) {
          console.error("Error sending trip location update:", error);
        }
      }
    });

    if (sentCount > 0) {
      console.log(
        `📡 [Trip Location] Broadcasted trip ${tripId} location update to ${sentCount} admin(s)`
      );
    }
  }

  function broadcastTripLocationToParents(tripId, locationData) {
    let sentCount = 0;
    const studentStopETAs = locationData.studentStopETAs || null;

    debugIngest("ws_broadcast_to_parents_start", "Broadcasting to parents", {
      tripId,
      parentSubscriptionsCount: subscriptionsState.parentTripSubscriptions.size,
    });

    subscriptionsState.parentTripSubscriptions.forEach((subscriptions, id) => {
      const conn = connectionManager.getConnection(id);
      if (!conn || !conn.ws || conn.ws.readyState !== 1) return;

      subscriptions.forEach((subStr) => {
        try {
          const sub = JSON.parse(subStr);
          if (sub.tripId !== tripId) return;

          let studentETA = null;
          if (studentStopETAs && Array.isArray(studentStopETAs)) {
            studentETA = studentStopETAs.find(() => true);
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

          conn.ws.send(JSON.stringify(message));
          sentCount += 1;
        } catch (error) {
          console.error("Error sending trip location to parent:", error);
        }
      });
    });

    if (sentCount > 0) {
      console.log(
        `📡 [Parent Location] Broadcasted trip ${tripId} location to ${sentCount} parent(s)`
      );
    }
  }

  function broadcastTripAlert(alert) {
    broadcastToAdmins({
      type: "tripAlert",
      ...alert,
    });
    console.log(
      `🚨 [Trip Alert] Broadcasted alert for trip ${alert.tripId}: ${alert.alertType}`
    );
  }

  function sendToUser(userId, data, state) {
    const userWs = state.userConnections[userId];
    if (userWs && userWs.readyState === 1) {
      userWs.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  return {
    filterDriversByCompany,
    filterRidesByCompany,
    broadcastToAdmins,
    broadcastTripLocationUpdate,
    broadcastTripLocationToParents,
    broadcastTripAlert,
    sendToUser,
  };
}

module.exports = {
  createBroadcastService,
};
