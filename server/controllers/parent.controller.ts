require("dotenv").config();
import { NextFunction, Request, Response } from "express";
import prisma from "../utils/prisma";
import bcrypt from "bcryptjs";
import { sendToken } from "../utils/send-token";
import { sendEmail } from "../utils/send-email";
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken, {
  lazyLoading: true,
});

// Normalize phone number to E.164 format
const normalizePhoneNumber = (phoneNumber: string): string => {
  if (!phoneNumber) return "";
  let normalized = phoneNumber.trim().replace(/[\s\-\(\)\.]/g, "");
  if (!normalized.startsWith("+")) {
    normalized = `+${normalized}`;
  }
  return normalized;
};

// Register parent
export const registerParent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { phoneNumber, email, firstName, lastName, password } = req.body;

    if (!phoneNumber && !email) {
      return res.status(400).json({
        success: false,
        message: "Phone number or email is required",
      });
    }

    if (!firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: "First name and last name are required",
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // Check if parent already exists
    if (phoneNumber) {
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      console.log(`[Parent Registration] Checking for existing parent with phone: ${normalizedPhone}`);
      
      const existingByPhone = await prisma.parent.findUnique({
        where: { phoneNumber: normalizedPhone },
      });
      
      if (existingByPhone) {
        console.log(`[Parent Registration] Phone number already exists: ${normalizedPhone}`);
        return res.status(400).json({
          success: false,
          message: "This phone number is already registered. Please use a different phone number or try logging in.",
        });
      }
    }

    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      console.log(`[Parent Registration] Checking for existing parent with email: ${normalizedEmail}`);
      
      const existingByEmail = await prisma.parent.findUnique({
        where: { email: normalizedEmail },
      });
      
      if (existingByEmail) {
        console.log(`[Parent Registration] Email already exists: ${normalizedEmail}`);
        return res.status(400).json({
          success: false,
          message: "This email is already registered. Please use a different email or try logging in.",
        });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Create parent
    const normalizedPhone = phoneNumber ? normalizePhoneNumber(phoneNumber) : undefined;
    const normalizedEmail = email ? email.trim().toLowerCase() : undefined;
    
    console.log(`[Parent Registration] Creating parent with phone: ${normalizedPhone}, email: ${normalizedEmail}`);
    
    const parent = await prisma.parent.create({
      data: {
        phoneNumber: normalizedPhone,
        email: normalizedEmail,
        firstName,
        lastName,
        password: hashedPassword,
        verificationCode,
        isVerified: false,
      },
    });
    
    console.log(`[Parent Registration] Parent created successfully with ID: ${parent.id}`);

    // Send verification code via SMS or Email
    if (phoneNumber && process.env.TWILIO_SERVICE_SID) {
      try {
        await client.verify.v2
          .services(process.env.TWILIO_SERVICE_SID!)
          .verifications.create({
            channel: "sms",
            to: normalizePhoneNumber(phoneNumber),
          });
      } catch (error) {
        console.error("Failed to send SMS verification:", error);
      }
    } else if (email && process.env.EMAIL_USER) {
      try {
        await sendEmail({
          to: email,
          name: `${firstName} ${lastName}`,
          subject: "Verify your parent account",
          html: `
            <p>Hi ${firstName},</p>
            <p>Your verification code is <strong>${verificationCode}</strong>.</p>
            <p>This code will expire in 10 minutes.</p>
            <p>Thanks,<br>School Transportation Team</p>
          `,
        });
      } catch (error) {
        console.error("Failed to send email verification:", error);
      }
    }

    res.status(201).json({
      success: true,
      message: "Registration successful. Please verify your account.",
      parentId: parent.id,
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    
    // Handle Prisma unique constraint errors
    if (error.code === 'P2002') {
      // Prisma unique constraint violation
      const field = error.meta?.target?.[0] || 'field';
      let message = "Registration failed";
      
      if (field === 'phoneNumber') {
        message = "This phone number is already registered. Please use a different phone number or try logging in.";
      } else if (field === 'email') {
        message = "This email is already registered. Please use a different email or try logging in.";
      } else {
        message = `This ${field} is already in use. Please use a different ${field}.`;
      }
      
      return res.status(400).json({
        success: false,
        message: message,
      });
    }
    
    // Handle other errors
    res.status(400).json({
      success: false,
      message: error.message || "Registration failed. Please try again.",
    });
  }
};

// Verify parent account
export const verifyParent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { phoneNumber, email, verificationCode } = req.body;

    if (!verificationCode) {
      return res.status(400).json({
        success: false,
        message: "Verification code is required",
      });
    }

    let parent;
    if (phoneNumber) {
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      parent = await prisma.parent.findUnique({
        where: { phoneNumber: normalizedPhone },
      });
    } else if (email) {
      parent = await prisma.parent.findUnique({
        where: { email },
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Phone number or email is required",
      });
    }

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    if (parent.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Account already verified",
      });
    }

    // Verify code via Twilio if phone number
    if (phoneNumber && process.env.TWILIO_SERVICE_SID) {
      try {
        const verificationCheck = await client.verify.v2
          .services(process.env.TWILIO_SERVICE_SID!)
          .verificationChecks.create({
            to: normalizePhoneNumber(phoneNumber),
            code: verificationCode,
          });

        if (verificationCheck.status !== "approved") {
          return res.status(400).json({
            success: false,
            message: "Invalid or expired verification code",
          });
        }
      } catch (error: any) {
        // Fallback to stored verification code
        if (parent.verificationCode !== verificationCode) {
          return res.status(400).json({
            success: false,
            message: "Invalid verification code",
          });
        }
      }
    } else {
      // Verify using stored code
      if (parent.verificationCode !== verificationCode) {
        return res.status(400).json({
          success: false,
          message: "Invalid verification code",
        });
      }
    }

    // Update parent as verified
    const updatedParent = await prisma.parent.update({
      where: { id: parent.id },
      data: {
        isVerified: true,
        verificationCode: null,
      },
    });

    sendToken(updatedParent, res);
  } catch (error: any) {
    console.error("Verification error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Verification failed",
    });
  }
};

// Login parent
export const loginParent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { phoneNumber, email, password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    if (!phoneNumber && !email) {
      return res.status(400).json({
        success: false,
        message: "Phone number or email is required",
      });
    }

    let parent;
    if (phoneNumber) {
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      parent = await prisma.parent.findUnique({
        where: { phoneNumber: normalizedPhone },
      });
    } else {
      parent = await prisma.parent.findUnique({
        where: { email },
      });
    }

    if (!parent) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!parent.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your account first",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, parent.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    sendToken(parent, res);
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Login failed",
    });
  }
};

// Get parent's students
export const getParentStudents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parentId = req.parent!.id;

    const students = await prisma.parentStudent.findMany({
      where: { parentId },
      include: {
        student: {
          include: {
            stop: {
              include: {
                route: {
                  include: {
                    school: true,
                  },
                },
              },
            },
            school: true,
          },
        },
      },
    });

    res.json({
      success: true,
      students: students.map((ps: typeof students[0]) => ({
        ...ps.student,
        relationship: ps.relationship,
        isPrimary: ps.isPrimary,
      })),
    });
  } catch (error: any) {
    console.error("Get students error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch students",
    });
  }
};

// Get active trip for a student
export const getStudentActiveTrip = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId } = req.params;
    const parentId = req.parent!.id;

    // Verify parent has access to this student
    const parentStudent = await prisma.parentStudent.findFirst({
      where: {
        parentId,
        studentId,
      },
    });

    if (!parentStudent) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Get student's stop
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { stop: true },
    });

    console.log('[DEBUG] getStudentActiveTrip: Student data', {
      studentId,
      hasStudent: !!student,
      hasStop: !!student?.stop,
      stopId: student?.stop?.id,
      stopName: student?.stop?.name,
    });

    if (!student || !student.stop) {
      console.log('[DEBUG] getStudentActiveTrip: Student has no stop assigned');
      return res.json({
        success: true,
        trip: null,
        message: "Student has no assigned stop",
      });
    }

    // Extract stop after null check for TypeScript
    const studentStop = student.stop;

    // Check all trips for this stop (for debugging)
    const allTripsForStop = await prisma.scheduledTrip.findMany({
      where: {
        points: {
          some: {
            stopId: studentStop.id,
          },
        },
      },
      select: {
        id: true,
        status: true,
        name: true,
      },
    });
    console.log('[DEBUG] getStudentActiveTrip: All trips for stop', {
      stopId: studentStop.id,
      tripsCount: allTripsForStop.length,
      trips: allTripsForStop,
    });

    // Check all ACTIVE trips (regardless of stop) to see what exists
    const allActiveTrips = await prisma.scheduledTrip.findMany({
      where: {
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        status: true,
        points: {
          select: {
            id: true,
            name: true,
            stopId: true,
            order: true,
          },
        },
      },
    });
    const tripsWithDetails = allActiveTrips.map(trip => ({
      id: trip.id,
      name: trip.name,
      pointsCount: trip.points.length,
      points: trip.points.map(p => ({ id: p.id, name: p.name, stopId: p.stopId, order: p.order })),
      hasMatchingStop: trip.points.some(p => p.stopId === studentStop.id),
    }));
    
    console.log('[DEBUG] getStudentActiveTrip: All ACTIVE trips in system', {
      activeTripsCount: allActiveTrips.length,
      studentStopId: studentStop.id,
      studentStopName: studentStop.name,
      activeTrips: JSON.stringify(tripsWithDetails, null, 2),
    });
    
    // Check which trip (if any) has points matching the student's stop
    const tripsWithMatchingStop = allActiveTrips.filter(trip => 
      trip.points.some(p => p.stopId === studentStop.id)
    );
    console.log('[DEBUG] getStudentActiveTrip: Trips with matching stop', {
      matchingTripsCount: tripsWithMatchingStop.length,
      matchingTrips: tripsWithMatchingStop.map(trip => ({
        id: trip.id,
        name: trip.name,
        matchingPoints: trip.points.filter(p => p.stopId === studentStop.id).map(p => ({
          id: p.id,
          name: p.name,
          stopId: p.stopId,
          order: p.order,
        })),
      })),
    });

    // Find active or scheduled trip that includes this stop by stopId
    let activeTrip = await prisma.scheduledTrip.findFirst({
      where: {
        status: { in: ["ACTIVE", "SCHEDULED"] },
        points: {
          some: {
            stopId: studentStop.id,
          },
        },
      },
      include: {
        assignedCaptain: {
          select: {
            id: true,
            name: true,
            phone_number: true,
            selfiePhoto: true,
            vehicle_type: true,
            registration_number: true,
            vehicle_color: true,
            ratings: true,
          },
        },
        points: {
          orderBy: {
            order: "asc",
          },
        },
        progress: true,
        route: {
          include: {
            school: true,
          },
        },
      },
    });

    console.log('[DEBUG] getStudentActiveTrip: Trip query result', {
      foundTrip: !!activeTrip,
      tripId: activeTrip?.id,
      tripStatus: activeTrip?.status,
      tripName: activeTrip?.name,
    });

    if (!activeTrip) {
      console.log('[DEBUG] getStudentActiveTrip: No active or scheduled trip found');
      return res.json({
        success: true,
        trip: null,
        message: "No active or scheduled trip found",
      });
    }

    // Get student's specific point in the trip by stopId
    let studentPoint = activeTrip.points.find(
      (p: any) => p.stopId === studentStop.id
    );
    
    // Fallback to first point if not found
    if (!studentPoint) {
      studentPoint = activeTrip.points[0];
    }

    res.json({
      success: true,
      trip: {
        ...activeTrip,
        studentPoint,
      },
    });
  } catch (error: any) {
    console.error("Get active trip error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch active trip",
    });
  }
};

// Update notification token
export const updateNotificationToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { notificationToken } = req.body;
    const parentId = req.parent!.id;

    if (!notificationToken) {
      return res.status(400).json({
        success: false,
        message: "Notification token is required",
      });
    }

    const updatedParent = await prisma.parent.update({
      where: { id: parentId },
      data: { notificationToken },
    });

    res.json({
      success: true,
      message: "Notification token updated",
      parent: updatedParent,
    });
  } catch (error: any) {
    console.error("Update notification token error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update notification token",
    });
  }
};







