import express from "express";
import {
  getAllRides,
  getDriversById,
  getLoggedInDriverData,
  newRide,
  sendingOtpToPhone,
  updateDriverStatus,
  updateNotificationToken,
  updatingRideStatus,
  verifyingEmailOtp,
  verifyPhoneOtpForLogin,
  verifyPhoneOtpForRegistration,
  getScheduledTrips,
  startScheduledTrip,
  updateTripProgress,
  updateCaptainLocation,
} from "../controllers/driver.controller";
import { isAuthenticatedDriver } from "../middleware/isAuthenticated";

const driverRouter = express.Router();

driverRouter.post("/send-otp", sendingOtpToPhone);

driverRouter.post("/login", verifyPhoneOtpForLogin);

driverRouter.post("/verify-otp", verifyPhoneOtpForRegistration);

driverRouter.post("/registration-driver", verifyingEmailOtp);

driverRouter.get("/me", isAuthenticatedDriver, getLoggedInDriverData);

driverRouter.get("/get-drivers-data", getDriversById);

driverRouter.put("/update-status", isAuthenticatedDriver, updateDriverStatus);

driverRouter.put("/update-notification-token", isAuthenticatedDriver, updateNotificationToken);

driverRouter.post("/new-ride", isAuthenticatedDriver, newRide);

driverRouter.put(
  "/update-ride-status",
  isAuthenticatedDriver,
  updatingRideStatus
);

driverRouter.get("/get-rides", isAuthenticatedDriver, getAllRides);

// Scheduled Trips
driverRouter.get("/scheduled-trips", isAuthenticatedDriver, getScheduledTrips);
driverRouter.post("/start-trip/:tripId", isAuthenticatedDriver, startScheduledTrip);
driverRouter.post("/trip/progress", isAuthenticatedDriver, updateTripProgress);
driverRouter.post("/update-location", isAuthenticatedDriver, updateCaptainLocation);

export default driverRouter;
