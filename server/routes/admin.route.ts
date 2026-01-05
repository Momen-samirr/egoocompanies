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
  updateTripStatus,
  getScheduledTripEarningsSummary,
  getScheduledTripEarningsRange,
  getScheduledTripInvoice,
  getEmergencyLogs,
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  createCompanyAccount,
  getCompanyAccounts,
  updateCompanyAccount,
  deleteCompanyAccount,
  assignDriversToCompany,
  getCompanyDrivers,
  createTripTemplate,
  getTripTemplates,
  getTripTemplateById,
  updateTripTemplate,
  deleteTripTemplate,
  createTripsFromTemplate,
  getPendingDocuments,
  getDriverDocumentsForReview,
  reviewDriverDocument,
  getDocumentStatistics,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../controllers/admin.controller";
import {
  getTripLocationHistory,
  getTripLiveTracking,
  getTripRouteAnalysis,
  getTripAnalytics,
  getActiveTripsLive,
  getRoadDistanceToNextCheckpoint,
} from "../controllers/trip-tracking.controller";
import {
  getSchools,
  getSchoolById,
  createSchool,
  updateSchool,
  deleteSchool,
  getRoutes,
  getRouteById,
  createRoute,
  updateRoute,
  deleteRoute,
  getStops,
  getStopById,
  createStop,
  updateStop,
  deleteStop,
  getParents,
  getParentById,
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  updateParent,
  deleteParent,
  linkStudentToParent,
  unlinkStudentFromParent,
  updateParentStudentLink,
} from "../controllers/school.controller";
import {
  isAuthenticatedAdmin,
  isAdminUser,
} from "../middleware/isAuthenticated";

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
adminRouter.put(
  "/drivers/:id/status",
  isAuthenticatedAdmin,
  updateDriverStatus
);
adminRouter.put(
  "/drivers/:id/verify",
  isAuthenticatedAdmin,
  verifyDriverDocuments
);

// Document Management
adminRouter.get(
  "/documents/pending",
  isAuthenticatedAdmin,
  getPendingDocuments
);
adminRouter.get(
  "/drivers/:id/documents",
  isAuthenticatedAdmin,
  getDriverDocumentsForReview
);
adminRouter.post(
  "/drivers/:id/documents/review",
  isAuthenticatedAdmin,
  reviewDriverDocument
);
adminRouter.get(
  "/documents/stats",
  isAuthenticatedAdmin,
  getDocumentStatistics
);

// Companies
adminRouter.get("/companies", isAuthenticatedAdmin, getCompanies);
adminRouter.post(
  "/companies",
  isAuthenticatedAdmin,
  isAdminUser,
  createCompany
);
adminRouter.put(
  "/companies/:id",
  isAuthenticatedAdmin,
  isAdminUser,
  updateCompany
);
adminRouter.delete(
  "/companies/:id",
  isAuthenticatedAdmin,
  isAdminUser,
  deleteCompany
);

// Company Accounts
adminRouter.get(
  "/company-accounts",
  isAuthenticatedAdmin,
  isAdminUser,
  getCompanyAccounts
);
adminRouter.post(
  "/company-accounts",
  isAuthenticatedAdmin,
  isAdminUser,
  createCompanyAccount
);
adminRouter.put(
  "/company-accounts/:id",
  isAuthenticatedAdmin,
  isAdminUser,
  updateCompanyAccount
);
adminRouter.delete(
  "/company-accounts/:id",
  isAuthenticatedAdmin,
  isAdminUser,
  deleteCompanyAccount
);

// Company Driver Assignments
adminRouter.post(
  "/companies/:id/assign-drivers",
  isAuthenticatedAdmin,
  isAdminUser,
  assignDriversToCompany
);
adminRouter.get(
  "/companies/:id/drivers",
  isAuthenticatedAdmin,
  getCompanyDrivers
);

// Rides
adminRouter.get("/rides", isAuthenticatedAdmin, getAllRides);
adminRouter.get("/rides/:id", isAuthenticatedAdmin, getRideById);

// Analytics
adminRouter.get("/analytics", isAuthenticatedAdmin, getAnalytics);

// Notifications
adminRouter.post("/notifications/send", isAuthenticatedAdmin, sendNotification);
adminRouter.get("/notifications", isAuthenticatedAdmin, getNotifications);
adminRouter.get(
  "/notifications/unread-count",
  isAuthenticatedAdmin,
  getUnreadNotificationCount
);
adminRouter.put(
  "/notifications/:id/read",
  isAuthenticatedAdmin,
  markNotificationAsRead
);
adminRouter.put(
  "/notifications/mark-all-read",
  isAuthenticatedAdmin,
  markAllNotificationsAsRead
);

// Active Rides for Map
adminRouter.get(
  "/active-rides",
  isAuthenticatedAdmin,
  getActiveRidesWithLocations
);

// Scheduled Trips
adminRouter.post("/trips", isAuthenticatedAdmin, createScheduledTrip);
adminRouter.get(
  "/trips/earnings/summary",
  isAuthenticatedAdmin,
  getScheduledTripEarningsSummary
);
adminRouter.get(
  "/trips/earnings/range",
  isAuthenticatedAdmin,
  getScheduledTripEarningsRange
);
adminRouter.post(
  "/trips/earnings/invoice",
  isAuthenticatedAdmin,
  getScheduledTripInvoice
);
adminRouter.get("/trips", isAuthenticatedAdmin, getScheduledTrips);
adminRouter.get("/trips/:id", isAuthenticatedAdmin, getScheduledTripById);
adminRouter.put("/trips/:id", isAuthenticatedAdmin, updateScheduledTrip);
adminRouter.put("/trips/:id/status", isAuthenticatedAdmin, updateTripStatus);
adminRouter.delete("/trips/:id", isAuthenticatedAdmin, deleteScheduledTrip);
adminRouter.post(
  "/trips/:id/force-close",
  isAuthenticatedAdmin,
  forceCloseTrip
);
adminRouter.get(
  "/trips/:id/location-history",
  isAuthenticatedAdmin,
  getTripLocationHistory
);
adminRouter.get(
  "/trips/:id/live-tracking",
  isAuthenticatedAdmin,
  getTripLiveTracking
);
adminRouter.get(
  "/trips/:id/route-analysis",
  isAuthenticatedAdmin,
  getTripRouteAnalysis
);
adminRouter.get(
  "/trips/:id/road-distance",
  isAuthenticatedAdmin,
  getRoadDistanceToNextCheckpoint
);
adminRouter.get("/trips/:id/analytics", isAuthenticatedAdmin, getTripAnalytics);
adminRouter.get("/trips/active/live", isAuthenticatedAdmin, getActiveTripsLive);

// Emergency Logs
adminRouter.get("/emergency-logs", isAuthenticatedAdmin, getEmergencyLogs);

// Trip Templates
adminRouter.post("/trip-templates", isAuthenticatedAdmin, createTripTemplate);
adminRouter.get("/trip-templates", isAuthenticatedAdmin, getTripTemplates);
adminRouter.get(
  "/trip-templates/:id",
  isAuthenticatedAdmin,
  getTripTemplateById
);
adminRouter.put(
  "/trip-templates/:id",
  isAuthenticatedAdmin,
  updateTripTemplate
);
adminRouter.delete(
  "/trip-templates/:id",
  isAuthenticatedAdmin,
  deleteTripTemplate
);
adminRouter.post(
  "/trip-templates/:id/create-trips",
  isAuthenticatedAdmin,
  createTripsFromTemplate
);

// Schools
adminRouter.get("/schools", isAuthenticatedAdmin, getSchools);
adminRouter.get("/schools/:id", isAuthenticatedAdmin, getSchoolById);
adminRouter.post("/schools", isAuthenticatedAdmin, createSchool);
adminRouter.put("/schools/:id", isAuthenticatedAdmin, updateSchool);
adminRouter.delete("/schools/:id", isAuthenticatedAdmin, deleteSchool);

// Routes
adminRouter.get("/routes", isAuthenticatedAdmin, getRoutes);
adminRouter.get("/routes/:id", isAuthenticatedAdmin, getRouteById);
adminRouter.post("/routes", isAuthenticatedAdmin, createRoute);
adminRouter.put("/routes/:id", isAuthenticatedAdmin, updateRoute);
adminRouter.delete("/routes/:id", isAuthenticatedAdmin, deleteRoute);

// Stops
adminRouter.get("/stops", isAuthenticatedAdmin, getStops);
adminRouter.get("/stops/:id", isAuthenticatedAdmin, getStopById);
adminRouter.post("/stops", isAuthenticatedAdmin, createStop);
adminRouter.put("/stops/:id", isAuthenticatedAdmin, updateStop);
adminRouter.delete("/stops/:id", isAuthenticatedAdmin, deleteStop);

// Students
adminRouter.get("/students", isAuthenticatedAdmin, getStudents);
adminRouter.get("/students/:id", isAuthenticatedAdmin, getStudentById);
adminRouter.post("/students", isAuthenticatedAdmin, createStudent);
adminRouter.put("/students/:id", isAuthenticatedAdmin, updateStudent);
adminRouter.delete("/students/:id", isAuthenticatedAdmin, deleteStudent);

// Parents
adminRouter.get("/parents", isAuthenticatedAdmin, getParents);
adminRouter.get("/parents/:id", isAuthenticatedAdmin, getParentById);
adminRouter.put("/parents/:id", isAuthenticatedAdmin, updateParent);
adminRouter.delete("/parents/:id", isAuthenticatedAdmin, deleteParent);

// Parent-Student Links
adminRouter.post("/parent-students", isAuthenticatedAdmin, linkStudentToParent);
adminRouter.delete(
  "/parent-students/:parentId/:studentId",
  isAuthenticatedAdmin,
  unlinkStudentFromParent
);
adminRouter.put(
  "/parent-students/:parentId/:studentId",
  isAuthenticatedAdmin,
  updateParentStudentLink
);

export default adminRouter;
