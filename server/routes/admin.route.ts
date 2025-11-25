import express from "express";
import {
  adminLogin,
  getDashboardStats,
  getAllUsers,
  getUserById,
  updateUserStatus,
  getAllDrivers,
  getDriverById,
  updateDriverStatus,
  verifyDriverDocuments,
  getAllRides,
  getRideById,
  getAnalytics,
  sendNotification,
  getActiveRidesWithLocations,
  createScheduledTrip,
  getScheduledTrips,
  getScheduledTripById,
  updateScheduledTrip,
  deleteScheduledTrip,
  forceCloseTrip,
  getScheduledTripEarningsSummary,
  getScheduledTripEarningsRange,
  getScheduledTripInvoice,
  getEmergencyLogs,
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
} from "../controllers/admin.controller";
import { isAuthenticatedAdmin } from "../middleware/isAuthenticated";

const adminRouter = express.Router();

// Auth
adminRouter.post("/login", adminLogin);

// Dashboard
adminRouter.get("/dashboard/stats", isAuthenticatedAdmin, getDashboardStats);

// Users
adminRouter.get("/users", isAuthenticatedAdmin, getAllUsers);
adminRouter.get("/users/:id", isAuthenticatedAdmin, getUserById);
adminRouter.put("/users/:id/status", isAuthenticatedAdmin, updateUserStatus);

// Drivers
adminRouter.get("/drivers", isAuthenticatedAdmin, getAllDrivers);
adminRouter.get("/drivers/:id", isAuthenticatedAdmin, getDriverById);
adminRouter.put("/drivers/:id/status", isAuthenticatedAdmin, updateDriverStatus);
adminRouter.put("/drivers/:id/verify", isAuthenticatedAdmin, verifyDriverDocuments);

// Companies
adminRouter.get("/companies", isAuthenticatedAdmin, getCompanies);
adminRouter.post("/companies", isAuthenticatedAdmin, createCompany);
adminRouter.put("/companies/:id", isAuthenticatedAdmin, updateCompany);
adminRouter.delete("/companies/:id", isAuthenticatedAdmin, deleteCompany);

// Rides
adminRouter.get("/rides", isAuthenticatedAdmin, getAllRides);
adminRouter.get("/rides/:id", isAuthenticatedAdmin, getRideById);

// Analytics
adminRouter.get("/analytics", isAuthenticatedAdmin, getAnalytics);

// Notifications
adminRouter.post("/notifications/send", isAuthenticatedAdmin, sendNotification);

// Active Rides for Map
adminRouter.get("/active-rides", isAuthenticatedAdmin, getActiveRidesWithLocations);

// Scheduled Trips
adminRouter.post("/trips", isAuthenticatedAdmin, createScheduledTrip);
adminRouter.get("/trips/earnings/summary", isAuthenticatedAdmin, getScheduledTripEarningsSummary);
adminRouter.get("/trips/earnings/range", isAuthenticatedAdmin, getScheduledTripEarningsRange);
adminRouter.post("/trips/earnings/invoice", isAuthenticatedAdmin, getScheduledTripInvoice);
adminRouter.get("/trips", isAuthenticatedAdmin, getScheduledTrips);
adminRouter.get("/trips/:id", isAuthenticatedAdmin, getScheduledTripById);
adminRouter.put("/trips/:id", isAuthenticatedAdmin, updateScheduledTrip);
adminRouter.delete("/trips/:id", isAuthenticatedAdmin, deleteScheduledTrip);
adminRouter.post("/trips/:id/force-close", isAuthenticatedAdmin, forceCloseTrip);

// Emergency Logs
adminRouter.get("/emergency-logs", isAuthenticatedAdmin, getEmergencyLogs);

export default adminRouter;

