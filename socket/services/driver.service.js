const geolib = require("geolib");

function createDriverService({
  driverStore,
  state,
  pubsubManager,
  metricsService,
  broadcastService,
}) {
  async function updateDriverLocationAndBroadcast(driverId, locationData) {
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
        lastSeen: now,
      };

      await driverStore.setDriver(driverId, driverData);
      state.drivers[driverId] = driverData;

      broadcastService.broadcastToAdmins({
        type: "driverLocationUpdate",
        driver: driverData,
      });

      if (pubsubManager && pubsubManager.enabled) {
        pubsubManager.publishLocationUpdate(driverId, locationData).catch((err) => {
          console.error("Error publishing location update:", err);
        });
      }

      if (metricsService) {
        metricsService.recordUpdate(Date.now() - startTime);
      }

      return driverData;
    } catch (error) {
      if (metricsService) {
        metricsService.recordError();
      }
      throw error;
    }
  }

  async function removeDriver(driverId) {
    await driverStore.removeDriver(driverId);
    delete state.drivers[driverId];
    broadcastService.broadcastToAdmins({
      type: "driverRemoved",
      driverId,
    });
  }

  async function findNearbyDrivers(userLat, userLon) {
    const allDrivers = await driverStore.getAllDrivers();

    return Object.entries(allDrivers)
      .filter(([, driver]) => {
        const isActive =
          driver.status === "active" ||
          driver.status === "Active" ||
          String(driver.status).toLowerCase() === "active";
        if (!isActive) return false;

        const distance = geolib.getDistance(
          { latitude: userLat, longitude: userLon },
          { latitude: driver.latitude, longitude: driver.longitude }
        );
        return distance <= 5000;
      })
      .map(([id, driver]) => ({ id, ...driver }));
  }

  async function cleanupStaleDrivers(thresholdMs = 300000) {
    const now = Date.now();
    const staleDriverIds = [];
    const allDrivers = await driverStore.getAllDrivers();

    Object.entries(allDrivers).forEach(([driverId, driver]) => {
      if (driver.lastSeen) {
        const lastSeenTime = new Date(driver.lastSeen).getTime();
        if (now - lastSeenTime > thresholdMs) {
          staleDriverIds.push(driverId);
        }
        return;
      }

      if (driver.timestamp) {
        const timestampTime = new Date(driver.timestamp).getTime();
        if (now - timestampTime > thresholdMs) {
          staleDriverIds.push(driverId);
        }
        return;
      }

      staleDriverIds.push(driverId);
    });

    for (const driverId of staleDriverIds) {
      await removeDriver(driverId);
    }

    return staleDriverIds.length;
  }

  async function loadDriversOnStartup() {
    const loadedDrivers = await driverStore.getAllDrivers();
    Object.assign(state.drivers, loadedDrivers);
    return loadedDrivers;
  }

  return {
    updateDriverLocationAndBroadcast,
    removeDriver,
    findNearbyDrivers,
    cleanupStaleDrivers,
    loadDriversOnStartup,
  };
}

module.exports = {
  createDriverService,
};
