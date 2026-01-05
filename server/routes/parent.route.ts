import express from "express";
import {
  registerParent,
  verifyParent,
  loginParent,
  getParentStudents,
  getStudentActiveTrip,
  updateNotificationToken,
} from "../controllers/parent.controller";
import { isAuthenticatedParent } from "../middleware/isAuthenticated";

const parentRouter = express.Router();

// Public routes
parentRouter.post("/register", registerParent);
parentRouter.post("/verify", verifyParent);
parentRouter.post("/login", loginParent);

// Protected routes
parentRouter.get("/students", isAuthenticatedParent, getParentStudents);
parentRouter.get(
  "/students/:studentId/trip",
  isAuthenticatedParent,
  getStudentActiveTrip
);
parentRouter.put(
  "/notification-token",
  isAuthenticatedParent,
  updateNotificationToken
);

export default parentRouter;







