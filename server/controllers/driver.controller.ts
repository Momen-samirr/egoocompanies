require("dotenv").config();
import { NextFunction, Request, Response } from "express";
import twilio from "twilio";
import prisma from "../utils/prisma";
import jwt from "jsonwebtoken";
import { sendToken } from "../utils/send-token";
import { sendEmail } from "../utils/send-email";
import {
  applyEmergencyTerminationPenalty,
  applyTripCompletionPayout,
} from "../services/trip-finance";
import { calculateTimingDifference } from "../utils/trip-timing";
import {
  sendWhatsAppToGroup,
  formatTripWhatsAppMessage,
  sendTripStatusToOperations,
} from "../utils/send-whatsapp-group";
import { queueTripStatusChange } from "../utils/whatsapp-report-queue";
import { calculateDistanceToCheckpoint } from "../utils/route-calculator";
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken, {
  lazyLoading: true,
});

// Normalize phone number to E.164 format
const normalizePhoneNumber = (phoneNumber: string): string => {
  if (!phoneNumber) return "";

  // Remove all whitespace and special characters except + and digits
  let normalized = phoneNumber.trim().replace(/[\s\-\(\)\.]/g, "");

  // Ensure it starts with +
  if (!normalized.startsWith("+")) {
    normalized = `+${normalized}`;
  }

  return normalized;
};

// sending otp to driver phone number
// TODO: Re-enable phone OTP verification when Twilio issues are resolved
// Currently bypassed - phone verification is disabled temporarily
export const sendingOtpToPhone = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let { phone_number } = req.body;

    if (!phone_number) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required.",
      });
    }

    // Normalize phone number to ensure consistent format
    phone_number = normalizePhoneNumber(phone_number);
    console.log(
      "⚠️ PHONE OTP BYPASSED - Phone verification is temporarily disabled"
    );
    console.log("Normalized phone number:", phone_number);

    // TODO: Re-enable Twilio phone OTP verification here
    // Original code:
    // const verification = await client.verify.v2
    //   ?.services(process.env.TWILIO_SERVICE_SID!)
    //   .verifications.create({
    //     channel: "sms",
    //     to: phone_number,
    //   });

    // Return success immediately without calling Twilio
    res.status(201).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error: any) {
    console.error("Error in sendingOtpToPhone:", error);
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred.",
    });
  }
};

// verifying otp for login
// TODO: Re-enable phone OTP verification when Twilio issues are resolved
// Currently bypassed - phone verification is disabled temporarily, driver is found directly by phone number
export const verifyPhoneOtpForLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let { phone_number, otp } = req.body;

    if (!phone_number) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required.",
      });
    }

    // Normalize phone number for database lookup
    const originalPhoneNumber = phone_number;
    phone_number = normalizePhoneNumber(phone_number);

    console.log(
      "⚠️ PHONE OTP BYPASSED - Phone verification is temporarily disabled"
    );
    console.log("Verifying login for phone number:");
    console.log("  Original:", originalPhoneNumber);
    console.log("  Normalized:", phone_number);
    console.log("  OTP provided (ignored):", otp);

    // TODO: Re-enable Twilio phone OTP verification here
    // Original code:
    // const verificationCheck = await client.verify.v2
    //   .services(process.env.TWILIO_SERVICE_SID!)
    //   .verificationChecks.create({
    //     to: phone_number,
    //     code: otp,
    //   });
    // if (verificationCheck.status !== "approved") {
    //   return res.status(400).json({
    //     success: false,
    //     message: "OTP is incorrect or expired.",
    //   });
    // }

    // Bypass phone OTP verification and find driver directly by phone number
    const driver = await prisma.driver.findUnique({
      where: {
        phone_number,
      },
    });

    // If not found with normalized, try with original format
    if (!driver) {
      const driverWithOriginal = await prisma.driver.findUnique({
        where: {
          phone_number: originalPhoneNumber,
        },
      });

      if (driverWithOriginal) {
        sendToken(driverWithOriginal, res);
        return;
      }

      return res.status(404).json({
        success: false,
        message: "Driver not found. Please register first.",
      });
    }

    sendToken(driver, res);
  } catch (error: any) {
    console.error("Unexpected error:", error);
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred.",
    });
  }
};

// verifying phone otp for registration
// TODO: Re-enable phone OTP verification when Twilio issues are resolved
// Currently bypassed - phone verification is disabled temporarily, proceeds directly to email OTP
export const verifyPhoneOtpForRegistration = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let { phone_number, otp } = req.body;

    if (!phone_number) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required.",
      });
    }

    // Normalize phone number to ensure consistent format
    const originalPhoneNumber = phone_number;
    phone_number = normalizePhoneNumber(phone_number);

    console.log(
      "⚠️ PHONE OTP BYPASSED - Phone verification is temporarily disabled"
    );
    console.log("Verifying registration OTP for phone number:");
    console.log("  Original:", originalPhoneNumber);
    console.log("  Normalized:", phone_number);
    console.log("  OTP provided (ignored):", otp);

    // TODO: Re-enable Twilio phone OTP verification here
    // Original code:
    // const verificationCheck = await client.verify.v2
    //   .services(process.env.TWILIO_SERVICE_SID!)
    //   .verificationChecks.create({
    //     to: phone_number,
    //     code: otp,
    //   });
    // if (verificationCheck.status !== "approved") {
    //   return res.status(400).json({
    //     success: false,
    //     message: "OTP is incorrect or expired.",
    //   });
    // }

    // Bypass phone OTP verification and proceed directly to email OTP
    // Update the phone number in request body to normalized version
    req.body.phone_number = phone_number;
    await sendingOtpToEmail(req, res);
  } catch (error: any) {
    console.error("Unexpected error:", error);
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred.",
    });
  }
};

// sending otp to email
export const sendingOtpToEmail = async (req: Request, res: Response) => {
  try {
    const {
      name,
      country,
      phone_number,
      email,
      vehicle_type,
      registration_number,
      registration_date,
      driving_license,
      vehicle_color,
      rate,
    } = req.body;

    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    const driver = {
      name,
      country,
      phone_number,
      email,
      vehicle_type,
      registration_number,
      registration_date,
      driving_license,
      vehicle_color,
      rate,
    };
    const token = jwt.sign(
      {
        driver,
        otp,
      },
      process.env.EMAIL_ACTIVATION_SECRET!,
      {
        expiresIn: "5m",
      }
    );
    // Check if email service is configured
    if (!process.env.EMAIL_USER) {
      console.error("Email service is not configured");
      return res.status(500).json({
        success: false,
        message: "Email service is not configured. Please contact support.",
      });
    }

    try {
      await sendEmail({
        to: email,
        name: name,
        subject: "Verify your email address!",
        html: `
          <p>Hi ${name},</p>
          <p>Your Egoo verification code is <strong>${otp}</strong>. If you didn't request for this OTP, please ignore this email!</p>
          <p>Thanks,<br>Egoo Team</p>
        `,
      });
      res.status(201).json({
        success: true,
        token,
      });
    } catch (error: any) {
      console.error("Email Error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to send email",
      });
    }
  } catch (error) {
    console.log(error);
  }
};

// verifying email otp and creating driver account
export const verifyingEmailOtp = async (req: Request, res: Response) => {
  try {
    const { otp, token } = req.body;

    const newDriver: any = jwt.verify(
      token,
      process.env.EMAIL_ACTIVATION_SECRET!
    );

    if (newDriver.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "OTP is not correct or expired!",
      });
    }

    const {
      name,
      country,
      phone_number,
      email,
      vehicle_type,
      registration_number,
      registration_date,
      driving_license,
      vehicle_color,
      rate,
    } = newDriver.driver;

    const driver = await prisma.driver.create({
      data: {
        name,
        country,
        phone_number,
        email,
        vehicle_type,
        registration_number,
        registration_date,
        driving_license,
        vehicle_color,
        rate,
      },
    });
    sendToken(driver, res);
  } catch (error) {
    console.log(error);
    res.status(400).json({
      success: false,
      message: "Your otp is expired!",
    });
  }
};

// get logged in driver data Here
export const getLoggedInDriverData = async (req: any, res: Response) => {
  try {
    const driver = req.driver;

    // Get completed scheduled trips count for this driver
    const completedScheduledTripsCount = await prisma.scheduledTrip.count({
      where: {
        assignedCaptainId: driver.id,
        status: "COMPLETED",
      },
    });

    // Exclude totalEarning from driver data
    const { totalEarning, ...driverWithoutEarnings } = driver;

    // Add completed scheduled trips count to driver data
    const driverWithStats = {
      ...driverWithoutEarnings,
      completedScheduledTrips: completedScheduledTripsCount,
    };

    res.status(201).json({
      success: true,
      driver: driverWithStats,
    });
  } catch (error) {
    console.log(error);
  }
};

// updating driver status
export const updateDriverStatus = async (req: any, res: Response) => {
  try {
    const { status } = req.body;

    const driver = await prisma.driver.update({
      where: {
        id: req.driver.id!,
      },
      data: {
        status,
      },
    });
    res.status(201).json({
      success: true,
      driver,
    });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// updating driver notification token
export const updateNotificationToken = async (req: any, res: Response) => {
  try {
    const { notificationToken } = req.body;

    if (!notificationToken) {
      return res.status(400).json({
        success: false,
        message: "Notification token is required",
      });
    }

    const driver = await prisma.driver.update({
      where: {
        id: req.driver.id!,
      },
      data: {
        notificationToken,
      },
    });
    res.status(201).json({
      success: true,
      driver,
      message: "Notification token updated successfully",
    });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// get drivers data with id
export const getDriversById = async (req: Request, res: Response) => {
  try {
    const { ids } = req.query as any;
    console.log(ids, "ids");
    if (!ids) {
      return res.status(400).json({ message: "No driver IDs provided" });
    }

    const driverIds = ids.split(",");

    // Fetch drivers from database
    const drivers = await prisma.driver.findMany({
      where: {
        id: { in: driverIds },
      },
    });

    res.json(drivers);
  } catch (error) {
    console.error("Error fetching driver data:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// creating new ride
export const newRide = async (req: any, res: Response) => {
  try {
    const {
      userId,
      charge,
      status,
      currentLocationName,
      destinationLocationName,
      distance,
    } = req.body;

    const newRide = await prisma.rides.create({
      data: {
        userId,
        driverId: req.driver.id,
        charge: parseFloat(charge),
        status,
        currentLocationName,
        destinationLocationName,
        distance,
      },
      include: {
        driver: true,
        user: true,
      },
    });

    // Notify socket server to send real-time update to user
    try {
      const axios = require("axios");
      const SOCKET_SERVER_URL =
        process.env.SOCKET_SERVER_URL || "http://localhost:3001";

      // Prepare ride data for the user (matching the format expected by user app)
      const rideData = {
        driver: {
          ...req.driver,
          currentLocation: req.body.currentLocation || null,
          marker: req.body.marker || null,
          distance: parseFloat(distance),
        },
        currentLocation: req.body.currentLocation || null,
        marker: req.body.marker || null,
        distance: parseFloat(distance),
        rideData: newRide,
      };

      await axios
        .post(`${SOCKET_SERVER_URL}/api/notify-ride-accepted`, {
          userId,
          rideData,
        })
        .catch((error: any) => {
          // Don't fail the request if socket server is unavailable
          console.log("⚠️ Could not notify socket server:", error.message);
        });
    } catch (socketError) {
      // Don't fail the request if socket notification fails
      console.log("⚠️ Socket notification error (non-critical):", socketError);
    }

    res.status(201).json({ success: true, newRide });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// updating ride status
export const updatingRideStatus = async (req: any, res: Response) => {
  try {
    const { rideId, rideStatus } = req.body;

    // Validate input
    if (!rideId || !rideStatus) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid input data" });
    }

    const driverId = req.driver?.id;
    if (!driverId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Fetch the ride data to get the rideCharge
    const ride = await prisma.rides.findUnique({
      where: {
        id: rideId,
      },
    });

    if (!ride) {
      return res
        .status(404)
        .json({ success: false, message: "Ride not found" });
    }

    const rideCharge = ride.charge;

    // Update ride status
    const updatedRide = await prisma.rides.update({
      where: {
        id: rideId,
        driverId,
      },
      data: {
        status: rideStatus,
      },
      include: {
        user: true,
      },
    });

    if (rideStatus === "Completed") {
      // Update driver stats if the ride is completed
      await prisma.driver.update({
        where: {
          id: driverId,
        },
        data: {
          totalEarning: {
            increment: rideCharge,
          },
          totalRides: {
            increment: 1,
          },
        },
      });

      // Notify socket server to send real-time update to user about ride completion
      try {
        const axios = require("axios");
        const SOCKET_SERVER_URL =
          process.env.SOCKET_SERVER_URL || "http://localhost:3001";

        await axios
          .post(`${SOCKET_SERVER_URL}/api/notify-ride-completed`, {
            userId: updatedRide.userId,
            rideId: rideId,
            rideData: updatedRide,
          })
          .catch((error: any) => {
            // Don't fail the request if socket server is unavailable
            console.log(
              "⚠️ Could not notify socket server about ride completion:",
              error.message
            );
          });
      } catch (socketError) {
        // Don't fail the request if socket notification fails
        console.log(
          "⚠️ Socket notification error (non-critical):",
          socketError
        );
      }
    }

    res.status(201).json({
      success: true,
      updatedRide,
    });
  } catch (error: any) {
    console.error(error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// getting drivers rides
export const getAllRides = async (req: any, res: Response) => {
  const rides = await prisma.rides.findMany({
    where: {
      driverId: req.driver?.id,
    },
    include: {
      driver: true,
      user: true,
    },
  });
  res.status(201).json({
    rides,
  });
};

// Get driver statistics for overview
export const getDriverStats = async (req: any, res: Response) => {
  try {
    const driverId = req.driver?.id;

    if (!driverId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Get today's date range (start and end of today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Completed trips today (regular rides)
    const completedTripsToday = await prisma.rides.count({
      where: {
        driverId,
        status: "Completed",
        cratedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // Completed scheduled trips today
    const completedScheduledTripsToday = await prisma.scheduledTrip.count({
      where: {
        assignedCaptainId: driverId,
        status: "COMPLETED",
        updatedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // Failed/missed trips (scheduled trips with FAILED status)
    const failedTrips = await prisma.scheduledTrip.count({
      where: {
        assignedCaptainId: driverId,
        status: "FAILED",
      },
    });

    // Upcoming scheduled trips (SCHEDULED status)
    const upcomingScheduledTrips = await prisma.scheduledTrip.count({
      where: {
        assignedCaptainId: driverId,
        status: "SCHEDULED",
        scheduledTime: {
          gte: new Date(),
        },
      },
    });

    // Active trip (ACTIVE status)
    const activeTrip = await prisma.scheduledTrip.findFirst({
      where: {
        assignedCaptainId: driverId,
        status: "ACTIVE",
      },
      include: {
        points: true,
        progress: true,
      },
    });

    // Active regular ride (Ongoing status)
    const activeRide = await prisma.rides.findFirst({
      where: {
        driverId,
        status: "Ongoing",
      },
      include: {
        user: true,
      },
    });

    // Total completed trips (all time)
    const totalCompletedTrips = await prisma.rides.count({
      where: {
        driverId,
        status: "Completed",
      },
    });

    // Total completed scheduled trips (all time)
    const totalCompletedScheduledTrips = await prisma.scheduledTrip.count({
      where: {
        assignedCaptainId: driverId,
        status: "COMPLETED",
      },
    });

    res.status(200).json({
      success: true,
      stats: {
        completedTripsToday: completedTripsToday + completedScheduledTripsToday,
        failedTrips,
        upcomingScheduledTrips,
        activeTrip:
          activeTrip || activeRide
            ? {
                type: activeTrip ? "scheduled" : "regular",
                id: activeTrip?.id || activeRide?.id,
                name:
                  activeTrip?.name ||
                  `${activeRide?.currentLocationName} → ${activeRide?.destinationLocationName}`,
              }
            : null,
        totalCompletedTrips: totalCompletedTrips + totalCompletedScheduledTrips,
      },
    });
  } catch (error: any) {
    console.error("Error fetching driver stats:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch driver statistics",
    });
  }
};

// Get Scheduled Trips for Captain
export const getScheduledTrips = async (req: any, res: Response) => {
  try {
    const { status, latitude, longitude, date } = req.query;
    const captainId = req.driver?.id;

    if (!captainId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Only show trips assigned to this captain (exclude trips with null assignedCaptainId)
    const where: any = {
      assignedCaptainId: captainId, // This will only match trips assigned to this captain
      // Note: Trips with null assignedCaptainId won't match, so they won't appear for any captain
    };

    if (status) {
      where.status = status;
    }

    // Add date filtering if date parameter is provided
    if (date) {
      try {
        const selectedDate = new Date(date as string);
        // Set to start of day (00:00:00.000)
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);

        // Set to end of day (23:59:59.999)
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        where.tripDate = {
          gte: startOfDay,
          lte: endOfDay,
        };
      } catch (error) {
        console.error("Error parsing date parameter:", error);
        // If date parsing fails, continue without date filtering
      }
    }

    // Get current location from query params if provided
    const currentLocation =
      latitude && longitude
        ? {
            lat: parseFloat(latitude as string),
            lng: parseFloat(longitude as string),
          }
        : null;

    const trips = await prisma.scheduledTrip.findMany({
      where,
      orderBy: { scheduledTime: "asc" },
      include: {
        points: {
          orderBy: { order: "asc" },
        },
        progress: true,
        company: true,
      },
    });

    // Get captain's current status
    const captain = await prisma.driver.findUnique({
      where: { id: captainId },
      select: { status: true },
    });

    const isOnline = captain?.status === "active";

    // Helper function to parse employees JSON field
    const parseEmployees = (
      employees: any
    ): Array<{ name: string; employeeId?: string }> | null => {
      if (!employees) return null;
      if (typeof employees === "string") {
        try {
          const parsed = JSON.parse(employees);
          return Array.isArray(parsed) ? parsed : null;
        } catch {
          return null;
        }
      }
      if (Array.isArray(employees)) {
        return employees;
      }
      return null;
    };

    // For each scheduled trip, check activation status if it's scheduled
    const tripsWithActivationStatus = await Promise.all(
      trips.map(async (trip) => {
        let activationStatus = null;

        if (trip.status === "SCHEDULED") {
          // First check if captain is online
          if (!isOnline) {
            activationStatus = {
              canActivate: false,
              reason: "You must be online to start trips",
            };
          } else {
            // Use current location from request, or fall back to stored location in progress
            let locationToUse = currentLocation;

            if (!locationToUse) {
              const progress = trip.progress;
              if (progress && progress.lastLatitude && progress.lastLongitude) {
                locationToUse = {
                  lat: progress.lastLatitude,
                  lng: progress.lastLongitude,
                };
              }
            }

            if (locationToUse) {
              const { checkTripActivationConditions } = await import(
                "../utils/trip-activation"
              );
              const result = await checkTripActivationConditions(
                trip.id,
                locationToUse
              );
              activationStatus = {
                canActivate: result.canActivate,
                reason: result.reason,
                distanceToFirstPoint: result.distanceToFirstPoint,
                isWithinTimeWindow: result.isWithinTimeWindow,
                isTooEarly: result.isTooEarly,
                earliestStartTime: result.earliestStartTime?.toISOString(),
              };
            } else {
              activationStatus = {
                canActivate: false,
                reason:
                  "Location not available. Please enable location services and try again.",
              };
            }
          }
        }

        const tripWithParsedEmployees = {
          ...trip,
          points: trip.points.map((point: any) => ({
            ...point,
            employees: parseEmployees(point.employees),
          })),
          activationStatus,
        };

        return tripWithParsedEmployees;
      })
    );

    res.status(200).json({
      success: true,
      trips: tripsWithActivationStatus,
    });
  } catch (error: any) {
    console.error("Get scheduled trips error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Start Scheduled Trip
export const startScheduledTrip = async (req: any, res: Response) => {
  try {
    const { tripId } = req.params;
    const { latitude, longitude } = req.body;
    const captainId = req.driver?.id;

    if (!captainId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Current location (latitude, longitude) is required",
      });
    }

    // Check if captain is online
    const captain = await prisma.driver.findUnique({
      where: { id: captainId },
      select: { status: true },
    });

    if (!captain || captain.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "You must be online to start a trip",
      });
    }

    // Get the trip
    const trip = await prisma.scheduledTrip.findUnique({
      where: { id: tripId },
      include: {
        points: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    // Security check: Verify captain is assigned to this trip
    if (!trip.assignedCaptainId) {
      return res.status(403).json({
        success: false,
        message: "This trip has no assigned captain",
      });
    }

    if (trip.assignedCaptainId !== captainId) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this trip",
      });
    }

    if (trip.status !== "SCHEDULED") {
      return res.status(400).json({
        success: false,
        message: `Trip is already ${trip.status.toLowerCase()}`,
      });
    }

    // Check activation conditions again (security)
    const { checkTripActivationConditions } = await import(
      "../utils/trip-activation"
    );
    const activationCheck = await checkTripActivationConditions(tripId, {
      lat: latitude,
      lng: longitude,
    });

    if (!activationCheck.canActivate) {
      return res.status(400).json({
        success: false,
        message: activationCheck.reason || "Trip cannot be activated",
        activationCheck,
      });
    }

    // Create or update trip progress
    const progress = await prisma.tripProgress.upsert({
      where: { scheduledTripId: tripId },
      update: {
        startedAt: new Date(),
        currentPointIndex: 0,
        lastLocationUpdate: new Date(),
        lastLatitude: latitude,
        lastLongitude: longitude,
      },
      create: {
        scheduledTripId: tripId,
        captainId,
        currentPointIndex: 0,
        startedAt: new Date(),
        lastLocationUpdate: new Date(),
        lastLatitude: latitude,
        lastLongitude: longitude,
      },
    });

    // Update trip status to ACTIVE
    const updatedTrip = await prisma.scheduledTrip.update({
      where: { id: tripId },
      data: {
        status: "ACTIVE",
      },
      include: {
        points: {
          orderBy: { order: "asc" },
        },
        progress: true,
        assignedCaptain: {
          select: {
            name: true,
            phone_number: true,
          },
        },
      },
    });

    // Send WhatsApp notifications
    try {
      const statusChangeTime = new Date();
      const tripData = {
        id: tripId,
        name: updatedTrip.name,
        tripType: updatedTrip.tripType,
        status: "ACTIVE" as const,
        scheduledTime: updatedTrip.scheduledTime,
        points: updatedTrip.points.map((p) => ({
          name: p.name,
          order: p.order,
        })),
        assignedCaptain: updatedTrip.assignedCaptain,
      };

      // Send immediate notification to Operations group
      await sendTripStatusToOperations(tripData, "ACTIVE", statusChangeTime);

      // Queue trip status change for batched reporting to Managers group
      const managersGroupId = process.env.WHATSAPP_MANAGERS_GROUP_ID;

      if (!managersGroupId) {
        console.warn(
          "WHATSAPP_MANAGERS_GROUP_ID not configured, skipping WhatsApp notification"
        );
      } else {
        await queueTripStatusChange(tripData, "ACTIVE", statusChangeTime);

        console.log(
          `📋 WhatsApp notification queued for ACTIVE trip: ${tripId}`
        );
      }
    } catch (whatsappError: any) {
      // Log error but don't fail the trip start if WhatsApp fails
      console.error(
        "Failed to send WhatsApp notification to managers group:",
        whatsappError.message || whatsappError
      );
      // Optionally, you could store this in a queue for retry
    }

    // Send push notifications to parents when trip starts
    try {
      const { sendNotificationToParent } = await import("../utils/send-notification");
      
      // Get all stop IDs from trip points
      const stopIds = updatedTrip.points
        .map((p: any) => p.stopId)
        .filter((id: string | null) => id !== null) as string[];

      if (stopIds.length > 0) {
        // Find all students at these stops
        const students = await prisma.student.findMany({
          where: {
            stopId: { in: stopIds },
          },
          include: {
            parents: {
              include: {
                parent: {
                  select: {
                    id: true,
                    notificationToken: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        });

        // Get unique parents (a parent might have multiple students)
        const parentMap = new Map<string, any>();
        students.forEach((student) => {
          student.parents.forEach((parentStudent) => {
            const parent = parentStudent.parent;
            if (parent && parent.notificationToken && !parentMap.has(parent.id)) {
              parentMap.set(parent.id, {
                ...parent,
                studentName: `${student.firstName} ${student.lastName}`,
              });
            }
          });
        });

        // #region agent log
        const fs = require('fs');
        const logPath = '/home/momen-samir/Work/ecar (Copy)/.cursor/debug.log';
        const logEntry = {
          location: 'driver.controller.ts:1140',
          message: 'Sending trip start notifications to parents',
          data: {
            tripId,
            tripName: updatedTrip.name,
            stopIds,
            studentsFound: students.length,
            uniqueParents: parentMap.size,
            parentIds: Array.from(parentMap.keys()),
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'trip-start-notifications',
          hypothesisId: 'A'
        };
        fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
        // #endregion

        // Send notifications to all parents
        const notificationPromises = Array.from(parentMap.values()).map(async (parent) => {
          try {
            const result = await sendNotificationToParent(
              parent.id,
              "Trip Started",
              `The trip "${updatedTrip.name}" has started. You can now track your child's ride in real-time.`,
              {
                type: "tripStarted",
                tripId: tripId,
                tripName: updatedTrip.name,
                studentName: parent.studentName,
              }
            );

            // #region agent log
            const logEntry2 = {
              location: 'driver.controller.ts:1175',
              message: 'Parent notification result',
              data: {
                parentId: parent.id,
                parentName: `${parent.firstName} ${parent.lastName}`,
                studentName: parent.studentName,
                success: result.success,
                message: result.message,
                hasToken: !!parent.notificationToken,
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'trip-start-notifications',
              hypothesisId: 'B'
            };
            fs.appendFileSync(logPath, JSON.stringify(logEntry2) + '\n');
            // #endregion

            return result;
          } catch (error: any) {
            console.error(`Error sending notification to parent ${parent.id}:`, error);
            // #region agent log
            const logEntry3 = {
              location: 'driver.controller.ts:1195',
              message: 'Parent notification error',
              data: {
                parentId: parent.id,
                parentName: `${parent.firstName} ${parent.lastName}`,
                error: error?.message,
                errorStack: error?.stack,
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'trip-start-notifications',
              hypothesisId: 'C'
            };
            fs.appendFileSync(logPath, JSON.stringify(logEntry3) + '\n');
            // #endregion
            return { success: false, message: error.message };
          }
        });

        const results = await Promise.allSettled(notificationPromises);
        const successCount = results.filter(
          (r) => r.status === "fulfilled" && r.value.success
        ).length;
        const failureCount = results.length - successCount;

        console.log(
          `📱 Sent trip start notifications to ${successCount} parents (${failureCount} failed) for trip ${tripId}`
        );
      } else {
        console.log(`⚠️ No stops found in trip ${tripId}, skipping parent notifications`);
      }
    } catch (parentNotificationError: any) {
      // Log error but don't fail the trip start if parent notifications fail
      console.error(
        "Failed to send parent notifications:",
        parentNotificationError.message || parentNotificationError
      );
    }

    // Helper function to parse employees JSON field
    const parseEmployees = (
      employees: any
    ): Array<{ name: string; employeeId?: string }> | null => {
      if (!employees) return null;
      if (typeof employees === "string") {
        try {
          const parsed = JSON.parse(employees);
          return Array.isArray(parsed) ? parsed : null;
        } catch {
          return null;
        }
      }
      if (Array.isArray(employees)) {
        return employees;
      }
      return null;
    };

    const tripWithParsedEmployees = updatedTrip
      ? {
          ...updatedTrip,
          points: updatedTrip.points.map((point: any) => ({
            ...point,
            employees: parseEmployees(point.employees),
          })),
        }
      : null;

    res.status(200).json({
      success: true,
      trip: tripWithParsedEmployees,
      message: "Trip started successfully",
    });
  } catch (error: any) {
    console.error("Start scheduled trip error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Update Trip Progress
export const updateTripProgress = async (req: any, res: Response) => {
  try {
    const { tripId, checkpointIndex, latitude, longitude } = req.body;
    const captainId = req.driver?.id;

    if (!captainId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (checkpointIndex === undefined || checkpointIndex === null) {
      return res.status(400).json({
        success: false,
        message: "checkpointIndex is required",
      });
    }

    // Get the trip
    const trip = (await prisma.scheduledTrip.findUnique({
      where: { id: tripId },
      include: {
        points: {
          orderBy: { order: "asc" },
        },
        progress: true,
      },
    })) as any; // Type assertion needed until Prisma client is regenerated after migration

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    // Security check: Verify captain is assigned to this trip
    if (!trip.assignedCaptainId) {
      return res.status(403).json({
        success: false,
        message: "This trip has no assigned captain",
      });
    }

    if (trip.assignedCaptainId !== captainId) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this trip",
      });
    }

    if (trip.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Trip is not active",
      });
    }

    if (!trip.progress) {
      return res.status(400).json({
        success: false,
        message: "Trip progress not found",
      });
    }

    // Validate checkpoint index
    if (checkpointIndex < 0 || checkpointIndex >= trip.points.length) {
      return res.status(400).json({
        success: false,
        message: "Invalid checkpoint index",
      });
    }

    // Mark the checkpoint as reached
    const checkpoint = trip.points[checkpointIndex];
    const reachedAt = new Date();

    // Log the reached time for debugging
    console.log("[Trip Progress] Checkpoint reached:");
    console.log("  Checkpoint:", checkpoint.name);
    console.log("  Reached at (UTC):", reachedAt.toISOString());
    console.log("  Reached at (Local):", reachedAt.toLocaleString());
    console.log(
      "  Expected time:",
      checkpoint.expectedTime
        ? new Date(checkpoint.expectedTime).toISOString()
        : "N/A"
    );

    await prisma.tripPoint.update({
      where: { id: checkpoint.id },
      data: {
        reachedAt,
      },
    });

    // Record location in TripLocationHistory when checkpoint is reached
    if (latitude && longitude) {
      try {
        // Calculate distance from route if we have the planned route
        const plannedRoute = trip.points.map((p: any) => ({
          latitude: p.latitude,
          longitude: p.longitude,
        }));

        const { calculateDistanceFromRoute, detectRouteDeviation } =
          await import("../utils/route-calculator");
        const currentLocation = { latitude, longitude };
        const distanceFromRoute = calculateDistanceFromRoute(
          currentLocation,
          plannedRoute
        );
        const deviation = detectRouteDeviation(
          currentLocation,
          plannedRoute,
          100
        );

        await prisma.tripLocationHistory.create({
          data: {
            scheduledTripId: tripId,
            driverId: captainId,
            latitude,
            longitude,
            distanceFromRoute,
            isRouteDeviation: deviation.isDeviated,
            isCheckpointReached: true,
            checkpointIndex: checkpointIndex,
            timestamp: reachedAt,
          },
        });
      } catch (error) {
        console.error("Error recording checkpoint location:", error);
        // Don't fail the request if location recording fails
      }
    }

    // Calculate timing difference for ARRIVAL trips
    let timing = null;
    if (trip.tripType === "ARRIVAL" && checkpoint.expectedTime) {
      console.log("[Trip Progress] Calculating timing for ARRIVAL trip");
      timing = calculateTimingDifference(checkpoint.expectedTime, reachedAt);
      if (timing) {
        console.log("[Trip Progress] Timing result:", timing);
      }
    }

    // Update progress
    const isFinalPoint = checkpoint.isFinalPoint;
    const nextPointIndex = isFinalPoint ? checkpointIndex : checkpointIndex + 1;

    const updateData: any = {
      currentPointIndex: nextPointIndex,
      lastLocationUpdate: new Date(),
    };

    if (latitude && longitude) {
      updateData.lastLatitude = latitude;
      updateData.lastLongitude = longitude;
    }

    // If final point reached, complete the trip
    if (isFinalPoint) {
      updateData.completedAt = new Date();
      await prisma.scheduledTrip.update({
        where: { id: tripId },
        data: {
          status: "COMPLETED",
        },
      });
      await applyTripCompletionPayout(tripId);
    }

    const updatedProgress = await prisma.tripProgress.update({
      where: { scheduledTripId: tripId },
      data: updateData,
    });

    // Get updated trip
    const updatedTrip = await prisma.scheduledTrip.findUnique({
      where: { id: tripId },
      include: {
        points: {
          orderBy: { order: "asc" },
        },
        progress: true,
      },
    });

    // Helper function to parse employees JSON field
    const parseEmployees = (
      employees: any
    ): Array<{ name: string; employeeId?: string }> | null => {
      if (!employees) return null;
      if (typeof employees === "string") {
        try {
          const parsed = JSON.parse(employees);
          return Array.isArray(parsed) ? parsed : null;
        } catch {
          return null;
        }
      }
      if (Array.isArray(employees)) {
        return employees;
      }
      return null;
    };

    const tripWithParsedEmployees = updatedTrip
      ? {
          ...updatedTrip,
          points: updatedTrip.points.map((point: any) => ({
            ...point,
            employees: parseEmployees(point.employees),
          })),
        }
      : null;

    const response: any = {
      success: true,
      trip: tripWithParsedEmployees,
      message: isFinalPoint
        ? "Trip completed successfully"
        : "Checkpoint reached",
    };

    // Include timing data if available (for ARRIVAL trips)
    if (timing) {
      response.timing = timing;
    }

    res.status(200).json(response);
  } catch (error: any) {
    console.error("Update trip progress error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Update Captain Location (enhanced to check trip activation)
export const updateCaptainLocation = async (req: any, res: Response) => {
  try {
    const { latitude, longitude, heading, accuracy, speed } = req.body;
    const captainId = req.driver?.id;

    if (!captainId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    // Optionally use message queue for processing (if enabled)
    const USE_LOCATION_QUEUE = process.env.USE_LOCATION_QUEUE === "true";
    if (USE_LOCATION_QUEUE) {
      try {
        const { queueLocationUpdate } = require("../services/locationQueue");
        await queueLocationUpdate({
          driverId: captainId,
          latitude,
          longitude,
          heading,
          accuracy,
          speed,
        });
        // Return immediately - queue will process asynchronously
        return res.status(200).json({
          success: true,
          message: "Location update queued successfully",
        });
      } catch (error: any) {
        console.error("Error queueing location update:", error);
        // Fall through to direct processing
      }
    }

    // Check if captain is online - only process location updates if online
    const captain = await prisma.driver.findUnique({
      where: { id: captainId },
      select: {
        status: true,
        name: true,
        vehicle_type: true,
      },
    });

    if (!captain || captain.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "You must be online to update location",
      });
    }

    // CRITICAL FIX: Notify socket server so dashboard continues to show driver
    // This ensures location updates from background app (via HTTP API) are visible on dashboard
    // When app is in background, WebSocket is disconnected, so we use HTTP bridge
    try {
      const axios = require("axios");
      const SOCKET_SERVER_URL =
        process.env.SOCKET_SERVER_URL || "http://localhost:8080";

      console.log(
        `📡 [Backend] Forwarding location update to socket server via HTTP bridge for driver ${captainId}`,
        {
          latitude,
          longitude,
          heading: heading !== undefined ? heading : null,
          status: captain.status || "active",
        }
      );

      await axios
        .post(`${SOCKET_SERVER_URL}/api/update-driver-location`, {
          driverId: captainId,
          latitude,
          longitude,
          heading: heading !== undefined ? heading : null, // Forward heading if available
          name: captain.name || "Driver",
          status: captain.status || "active",
          vehicleType: captain.vehicle_type || "Car",
        })
        .then(() => {
          console.log(
            `✅ [Backend] Successfully forwarded location update to socket server for driver ${captainId}`
          );
        })
        .catch((error: any) => {
          // Don't fail the request if socket server is unavailable
          console.warn(
            `⚠️ [Backend] Could not notify socket server about location update for driver ${captainId}:`,
            {
              error: error.message,
              code: error.code,
              status: error.response?.status,
            }
          );
        });
    } catch (socketError: any) {
      // Don't fail the request if socket notification fails
      console.warn("⚠️ [Backend] Socket notification error (non-critical):", {
        error: socketError.message,
        driverId: captainId,
      });
    }

    // Update location in any active trip progress and broadcast to parents
    const activeTrips = await prisma.scheduledTrip.findMany({
      where: {
        assignedCaptainId: captainId,
        status: "ACTIVE",
      },
      include: {
        progress: true,
        points: {
          orderBy: { order: "asc" },
        },
      },
    });

    for (const trip of activeTrips) {
      if (trip.progress) {
        await prisma.tripProgress.update({
          where: { scheduledTripId: trip.id },
          data: {
            lastLocationUpdate: new Date(),
            lastLatitude: latitude,
            lastLongitude: longitude,
          },
        });

        // Broadcast location update to parents via WebSocket server
        try {
          // In production, use https://ws.egoobus.com, in development use localhost
          const wsUrl = process.env.WEBSOCKET_URL || 
            (process.env.NODE_ENV === "production" 
              ? "https://ws.egoobus.com" 
              : "http://localhost:8080");
          const locationSpeed = speed !== undefined ? speed : 0; // Use provided speed or default to 0
          
          // Calculate basic ETA to next checkpoint (simplified calculation)
          const currentCheckpointIndex = trip.progress.currentPointIndex || 0;
          const nextCheckpoint = trip.points[currentCheckpointIndex];
          let etaToNextCheckpoint: { minutes: number; distanceMeters: number; method: string } | null = null;
          
          // #region agent log
          const fs = require('fs');
          const logPath = '/home/momen-samir/Work/ecar (Copy)/.cursor/debug.log';
          const logEntry = {
            location: 'driver.controller.ts:1563',
            message: 'ETA calculation inputs',
            data: {
              tripId: trip.id,
              currentCheckpointIndex,
              nextCheckpointExists: !!nextCheckpoint,
              nextCheckpointName: nextCheckpoint?.name,
              driverLocation: { latitude, longitude },
              locationSpeed,
              speedProvided: speed !== undefined,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'eta-calculation',
            hypothesisId: 'A'
          };
          fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
          // #endregion
          
          if (nextCheckpoint && nextCheckpoint.latitude && nextCheckpoint.longitude) {
            const distanceToCheckpoint = calculateDistanceToCheckpoint(
              { latitude, longitude },
              { 
                latitude: nextCheckpoint.latitude, 
                longitude: nextCheckpoint.longitude,
                order: nextCheckpoint.order || currentCheckpointIndex
              }
            );
            
            // Simple ETA calculation: assume average speed of 30 km/h if speed is 0
            const avgSpeedKmh = locationSpeed > 0 ? locationSpeed : 30;
            const etaMinutes = (distanceToCheckpoint / 1000) / (avgSpeedKmh / 60);
            
            // #region agent log
            const logEntry2 = {
              location: 'driver.controller.ts:1580',
              message: 'ETA calculation results',
              data: {
                tripId: trip.id,
                distanceToCheckpointMeters: distanceToCheckpoint,
                distanceToCheckpointKm: distanceToCheckpoint / 1000,
                locationSpeed,
                avgSpeedKmh,
                etaMinutes,
                etaMinutesRounded: Math.round(etaMinutes),
                nextCheckpointName: nextCheckpoint.name,
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'eta-calculation',
              hypothesisId: 'B'
            };
            fs.appendFileSync(logPath, JSON.stringify(logEntry2) + '\n');
            // #endregion
            
            etaToNextCheckpoint = {
              minutes: Math.round(etaMinutes),
              distanceMeters: Math.round(distanceToCheckpoint),
              method: "estimated",
            };
          }

          const broadcastPayload = {
            tripId: trip.id,
            driverId: captainId,
            location: { latitude, longitude, heading: heading !== undefined ? heading : null },
            speed: locationSpeed,
            deviationStatus: {
              isDeviated: false, // Simplified - could be enhanced with route calculation
              distance: 0,
            },
            eta: etaToNextCheckpoint,
            studentStopETAs: null, // Could be calculated if needed
            timestamp: new Date().toISOString(),
          };
          
          console.log(`[DEBUG] Broadcasting trip location update to WebSocket server for trip ${trip.id}`, {
            tripId: trip.id,
            driverId: captainId,
            hasLocation: !!broadcastPayload.location,
            location: broadcastPayload.location,
            wsUrl,
            isProduction: process.env.NODE_ENV === "production",
            envWebSocketUrl: process.env.WEBSOCKET_URL || "not set"
          });
          
          await fetch(`${wsUrl}/api/trip-location-update`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(broadcastPayload),
          })
          .then(async (response) => {
            if (response.ok) {
              console.log(`[DEBUG] ✅ Successfully broadcasted trip ${trip.id} location update to WebSocket server at ${wsUrl}`);
            } else {
              const errorText = await response.text();
              console.error(`[DEBUG] ❌ WebSocket server returned error for trip ${trip.id}:`, {
                status: response.status,
                statusText: response.statusText,
                error: errorText,
                wsUrl
              });
            }
          })
          .catch((error) => {
            console.error(
              `[DEBUG] ❌ WebSocket server not available for trip ${trip.id} location update:`,
              {
                error: error.message,
                wsUrl,
                isProduction: process.env.NODE_ENV === "production"
              }
            );
          });
        } catch (error: any) {
          // Silently fail - WebSocket broadcast is optional
          console.debug(`Error broadcasting trip ${trip.id} location update:`, error.message);
        }
      }
    }

    // Queue location history for batch insertion (if enabled)
    const ENABLE_LOCATION_HISTORY =
      process.env.ENABLE_LOCATION_HISTORY !== "false";
    if (ENABLE_LOCATION_HISTORY) {
      try {
        const {
          locationHistoryService,
        } = require("../services/locationHistoryService");
        locationHistoryService.queueLocation({
          driverId: captainId,
          latitude,
          longitude,
          heading: heading !== undefined ? heading : null,
          accuracy: accuracy !== undefined ? accuracy : null,
          speed: speed !== undefined ? speed : null,
        });
      } catch (error: any) {
        // Don't fail the request if history service fails
        console.log(
          "⚠️ Location history service error (non-critical):",
          error.message
        );
      }
    }

    // Record metrics (if enabled)
    const ENABLE_METRICS = process.env.ENABLE_METRICS !== "false";
    if (ENABLE_METRICS) {
      try {
        const { metricsCollector } = require("../utils/metrics");
        const updateStartTime = Date.now();
        // Calculate approximate latency (time to process request)
        const latency = Date.now() - updateStartTime;
        metricsCollector.recordUpdate(latency);
      } catch (error: any) {
        // Don't fail the request if metrics fail
        console.log(
          "⚠️ Metrics collection error (non-critical):",
          error.message
        );
      }
    }

    // Check for scheduled trips that might be ready to activate
    const scheduledTrips = await prisma.scheduledTrip.findMany({
      where: {
        assignedCaptainId: captainId,
        status: "SCHEDULED",
      },
      include: {
        points: {
          orderBy: { order: "asc" },
          take: 1,
        },
        progress: true,
      },
    });

    const activationResults = [];
    for (const trip of scheduledTrips) {
      if (trip.points.length > 0) {
        // Check if notification was already sent for this trip recently (within last 24 hours)
        // We check BEFORE calling checkTripActivationConditions to avoid creating unnecessary check records
        const oneDayAgo = new Date();
        oneDayAgo.setHours(oneDayAgo.getHours() - 24);

        const existingActivationCheck =
          await prisma.tripActivationCheck.findFirst({
            where: {
              scheduledTripId: trip.id,
              activated: true,
              createdAt: {
                gte: oneDayAgo,
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          });

        // Skip checking if notification was already sent recently
        // (We still log activation results for trips that already have notifications)
        const shouldSkipNotification = !!existingActivationCheck;
        if (shouldSkipNotification) {
          const timeSinceLastCheck =
            Date.now() - existingActivationCheck.createdAt.getTime();
          const minutesAgo = Math.floor(timeSinceLastCheck / (1000 * 60));
          console.log(
            `⏭️ Trip "${trip.name}" (${trip.id}) - notification already sent ${minutesAgo} minute(s) ago, skipping duplicate`
          );
        }

        // Check activation conditions (always check for logging and API response)
        const { checkTripActivationConditions } = await import(
          "../utils/trip-activation"
        );
        const result = await checkTripActivationConditions(trip.id, {
          lat: latitude,
          lng: longitude,
        });

        // Only send notification if conditions are met AND notification wasn't sent recently
        if (result.canActivate && !shouldSkipNotification) {
          // Send notification (only once per trip)
          const { sendTripActivationNotification } = await import(
            "../utils/send-notification"
          );
          const notificationResult = await sendTripActivationNotification(
            captainId,
            trip.id
          );

          if (notificationResult.success) {
            console.log(
              `📱 Trip activation notification sent to captain ${captainId} for trip ${trip.id}`
            );
          } else {
            console.error(
              `❌ Failed to send trip activation notification: ${notificationResult.message}`
            );
          }
        } else if (result.canActivate && shouldSkipNotification) {
          console.log(
            `⏭️ Skipping duplicate notification for trip ${trip.id} - already sent recently`
          );
        }

        activationResults.push({
          tripId: trip.id,
          tripName: trip.name,
          canActivate: result.canActivate,
          reason: result.reason,
          distanceToFirstPoint: result.distanceToFirstPoint,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Location updated successfully",
      activationChecks: activationResults,
    });
  } catch (error: any) {
    console.error("Update captain location error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Check if driver can use emergency termination today
export const checkEmergencyUsageStatus = async (req: any, res: Response) => {
  try {
    const driverId = req.driver?.id;

    if (!driverId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Get today's date range (start and end of today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if driver has used emergency termination today
    const todayUsage = await prisma.emergencyUsage.findFirst({
      where: {
        driverId,
        usedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: {
        usedAt: "desc",
      },
    });

    const canUse = !todayUsage;
    const lastUsedAt = todayUsage?.usedAt || null;

    res.status(200).json({
      success: true,
      canUse,
      lastUsedAt,
      message: canUse
        ? "Emergency termination is available"
        : "You have already used the emergency end option today.",
    });
  } catch (error: any) {
    console.error("Check emergency usage status error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Emergency terminate active trip
export const emergencyTerminateTrip = async (req: any, res: Response) => {
  try {
    const { tripId } = req.body;
    const driverId = req.driver?.id;

    if (!driverId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!tripId) {
      return res.status(400).json({
        success: false,
        message: "Trip ID is required",
      });
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if driver has already used emergency termination today
    const todayUsage = await prisma.emergencyUsage.findFirst({
      where: {
        driverId,
        usedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (todayUsage) {
      return res.status(400).json({
        success: false,
        message: "You have already used the emergency end option today.",
        lastUsedAt: todayUsage.usedAt,
      });
    }

    // Get the trip
    const trip = await prisma.scheduledTrip.findUnique({
      where: { id: tripId },
      include: {
        progress: true,
      },
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    // Security check: Verify driver is assigned to this trip
    if (!trip.assignedCaptainId || trip.assignedCaptainId !== driverId) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this trip",
      });
    }

    // Only allow emergency termination for ACTIVE trips
    if (trip.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: `Trip is not active. Current status: ${trip.status}`,
      });
    }

    // Update trip status to EMERGENCY_ENDED
    const now = new Date();
    const updatedTrip = await prisma.scheduledTrip.update({
      where: { id: tripId },
      data: {
        status: "EMERGENCY_ENDED",
        emergencyTerminatedAt: now,
        emergencyTerminatedBy: driverId,
      },
      include: {
        points: {
          orderBy: { order: "asc" },
        },
        progress: true,
        assignedCaptain: {
          select: {
            id: true,
            name: true,
            phone_number: true,
            email: true,
          },
        },
      },
    });

    await applyEmergencyTerminationPenalty(tripId);

    // Record emergency usage
    await prisma.emergencyUsage.create({
      data: {
        driverId,
        tripId,
        usedAt: now,
      },
    });

    // Update trip progress to mark as completed (emergency termination)
    if (trip.progress) {
      await prisma.tripProgress.update({
        where: { scheduledTripId: tripId },
        data: {
          completedAt: now,
        },
      });
    }

    res.status(200).json({
      success: true,
      trip: updatedTrip,
      message: "Trip emergency terminated successfully",
    });
  } catch (error: any) {
    console.error("Emergency terminate trip error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Upload driver document
export const uploadDriverDocument = async (req: any, res: Response) => {
  try {
    const driverId = req.driver.id;
    const { documentType, imageBase64 } = req.body;

    if (!documentType || !imageBase64) {
      return res.status(400).json({
        success: false,
        message: "Document type and image are required",
      });
    }

    const validDocumentTypes = [
      "selfie",
      "license",
      "license_front",
      "license_back",
      "criminal_record",
      "drug_test",
    ];
    if (!validDocumentTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid document type. Must be: selfie, license, license_front, license_back, criminal_record, or drug_test",
      });
    }

    // Import upload service
    const {
      uploadBase64ToCloudinary,
      generateDocumentFileName,
    } = require("../services/file-upload.service");

    // Generate unique file name
    const fileName = generateDocumentFileName(driverId, documentType);

    // Upload to Cloudinary
    const imageUrl = await uploadBase64ToCloudinary(imageBase64, fileName, {
      folder: "driver-documents",
    });

    // Get current driver data
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        driversLicensePhotos: true,
        documentStatuses: true,
        selfiePhoto: true,
        criminalRecordPhoto: true,
        drugTestPhoto: true,
      },
    });

    // Check if document already exists (to determine if it's an update)
    let isUpdate = false;
    if (documentType === "license_front" || documentType === "license_back") {
      const currentLicensePhotos = (driver?.driversLicensePhotos as any) || [];
      const side = documentType === "license_front" ? "front" : "back";
      isUpdate = currentLicensePhotos.some((photo: any) => photo.side === side);
    } else if (documentType === "license") {
      const currentLicensePhotos = (driver?.driversLicensePhotos as any) || [];
      isUpdate = currentLicensePhotos.some(
        (photo: any) => photo.side === "front"
      );
    } else {
      const fieldMap: Record<
        string,
        "selfiePhoto" | "criminalRecordPhoto" | "drugTestPhoto"
      > = {
        selfie: "selfiePhoto",
        criminal_record: "criminalRecordPhoto",
        drug_test: "drugTestPhoto",
      };
      const fieldName = fieldMap[documentType];
      if (fieldName && driver?.[fieldName]) {
        isUpdate = true;
      }
    }

    // Prepare update data
    const updateData: any = {
      // Reset verification status when new document is uploaded
      documentsVerified: false,
      documentsVerifiedAt: null,
      documentsVerifiedBy: null,
    };

    // Initialize documentStatuses if it doesn't exist
    const currentStatuses = (driver?.documentStatuses as any) || {};
    const newStatuses = { ...currentStatuses };

    // Handle different document types
    if (documentType === "license_front" || documentType === "license_back") {
      // Handle license photos as array
      const currentLicensePhotos = (driver?.driversLicensePhotos as any) || [];
      const side = documentType === "license_front" ? "front" : "back";

      // Find and update existing entry or add new one
      const existingIndex = currentLicensePhotos.findIndex(
        (photo: any) => photo.side === side
      );
      const updatedPhotos = [...currentLicensePhotos];
      if (existingIndex >= 0) {
        updatedPhotos[existingIndex] = { side, url: imageUrl };
      } else {
        updatedPhotos.push({ side, url: imageUrl });
      }

      updateData.driversLicensePhotos = updatedPhotos;
      newStatuses.licenseFront =
        documentType === "license_front"
          ? {
              status: "pending",
              reviewedAt: null,
              reviewedBy: null,
              rejectionReason: null,
              rejectedAt: null,
            }
          : newStatuses.licenseFront || {};
      newStatuses.licenseBack =
        documentType === "license_back"
          ? {
              status: "pending",
              reviewedAt: null,
              reviewedBy: null,
              rejectionReason: null,
              rejectedAt: null,
            }
          : newStatuses.licenseBack || {};
    } else if (documentType === "license") {
      // Legacy support: convert old license to front
      const currentLicensePhotos = (driver?.driversLicensePhotos as any) || [];
      const updatedPhotos = [...currentLicensePhotos];
      const existingFrontIndex = updatedPhotos.findIndex(
        (photo: any) => photo.side === "front"
      );
      if (existingFrontIndex >= 0) {
        updatedPhotos[existingFrontIndex] = { side: "front", url: imageUrl };
      } else {
        updatedPhotos.push({ side: "front", url: imageUrl });
      }
      updateData.driversLicensePhotos = updatedPhotos;
      newStatuses.licenseFront = {
        status: "pending",
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null,
        rejectedAt: null,
      };
    } else {
      // Map document type to database field
      const fieldMap: Record<string, string> = {
        selfie: "selfiePhoto",
        criminal_record: "criminalRecordPhoto",
        drug_test: "drugTestPhoto",
      };

      const fieldName = fieldMap[documentType];
      if (fieldName) {
        updateData[fieldName] = imageUrl;
      }

      // Set status for document type
      const statusKeyMap: Record<string, string> = {
        selfie: "selfie",
        criminal_record: "criminalRecord",
        drug_test: "drugTest",
      };
      const statusKey = statusKeyMap[documentType];
      if (statusKey) {
        newStatuses[statusKey] = {
          status: "pending",
          reviewedAt: null,
          reviewedBy: null,
          rejectionReason: null,
          rejectedAt: null,
        };
      }
    }

    updateData.documentStatuses = newStatuses;

    // Update driver record
    await prisma.driver.update({
      where: { id: driverId },
      data: updateData,
    });

    // Create notification for admin
    try {
      const {
        createDocumentNotification,
      } = require("../services/notification.service");
      const notificationResult = await createDocumentNotification(
        driverId,
        documentType,
        isUpdate
      );

      console.log("📄 Notification creation result:", {
        success: notificationResult.success,
        hasNotification: !!notificationResult.notification,
        driverId,
        documentType,
        isUpdate,
      });

      // Notify socket server to broadcast to admins
      if (notificationResult.success && notificationResult.notification) {
        try {
          const axios = require("axios");
          const SOCKET_SERVER_URL =
            process.env.SOCKET_SERVER_URL || "http://localhost:8080";

          console.log(
            `📡 Sending notification to socket server: ${SOCKET_SERVER_URL}/api/notify-document-upload`
          );

          const response = await axios.post(
            `${SOCKET_SERVER_URL}/api/notify-document-upload`,
            {
              notification: notificationResult.notification,
            },
            {
              timeout: 5000,
            }
          );

          console.log("✅ Notification sent to socket server:", response.data);
        } catch (socketError: any) {
          // Don't fail the request if socket server is unavailable
          console.error(
            "⚠️ Could not notify socket server about document upload:",
            socketError.message || socketError
          );
          if (socketError.response) {
            console.error("Socket server response:", socketError.response.data);
          }
        }
      } else {
        console.error("❌ Notification creation failed:", notificationResult);
      }
    } catch (notificationError: any) {
      // Don't fail the upload if notification creation fails
      console.error(
        "❌ Error creating notification:",
        notificationError.message || notificationError
      );
    }

    res.status(200).json({
      success: true,
      message: "Document uploaded successfully",
      documentUrl: imageUrl,
      documentType,
    });
  } catch (error: any) {
    console.error("Upload driver document error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to upload document",
    });
  }
};

// Get driver documents status
export const getDriverDocuments = async (req: any, res: Response) => {
  try {
    const driverId = req.driver.id;

    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        selfiePhoto: true,
        driversLicensePhoto: true,
        driversLicensePhotos: true,
        criminalRecordPhoto: true,
        drugTestPhoto: true,
        documentStatuses: true,
        documentsVerified: true,
        documentsVerifiedAt: true,
      },
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    const statuses = (driver.documentStatuses as any) || {};
    const licensePhotos = (driver.driversLicensePhotos as any) || [];

    // Get license front and back URLs
    const licenseFront = licensePhotos.find(
      (photo: any) => photo.side === "front"
    );
    const licenseBack = licensePhotos.find(
      (photo: any) => photo.side === "back"
    );

    // Helper to get document info
    const getDocumentInfo = (
      url: string | null | undefined,
      statusKey: string
    ) => {
      const status = statuses[statusKey] || {};
      return {
        url: url || undefined,
        uploaded: !!url,
        status: status.status || (url ? "pending" : undefined),
        rejectionReason: status.rejectionReason || undefined,
        reviewedAt: status.reviewedAt || undefined,
      };
    };

    res.status(200).json({
      success: true,
      documents: {
        selfie: getDocumentInfo(driver.selfiePhoto, "selfie"),
        licenseFront: getDocumentInfo(
          licenseFront?.url || driver.driversLicensePhoto,
          "licenseFront"
        ),
        licenseBack: getDocumentInfo(licenseBack?.url, "licenseBack"),
        criminalRecord: getDocumentInfo(
          driver.criminalRecordPhoto,
          "criminalRecord"
        ),
        drugTest: getDocumentInfo(driver.drugTestPhoto, "drugTest"),
        verified: driver.documentsVerified,
        verifiedAt: driver.documentsVerifiedAt,
      },
    });
  } catch (error: any) {
    console.error("Get driver documents error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};
