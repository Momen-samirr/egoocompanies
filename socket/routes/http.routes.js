const express = require("express");

function createHttpRoutes(controller) {
  const router = express.Router();

  router.get("/drivers", controller.getDrivers);
  router.get("/active-rides", controller.getActiveRides);
  router.get("/stats", controller.getStats);
  router.get("/health/redis", controller.getRedisHealth);
  router.get("/metrics", controller.getMetrics);

  router.post("/notify-ride-accepted", controller.notifyRideAccepted);
  router.post("/notify-ride-completed", controller.notifyRideCompleted);
  router.post("/update-driver-location", controller.updateDriverLocation);
  router.post("/trip-location-update", controller.tripLocationUpdate);
  router.post("/trip-alert", controller.tripAlert);
  router.post("/notify-document-upload", controller.notifyDocumentUpload);

  return router;
}

module.exports = {
  createHttpRoutes,
};
