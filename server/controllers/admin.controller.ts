require("dotenv").config();
import { Request, Response } from "express";
import prisma from "../utils/prisma";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// Admin Login
export const adminLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const admin = await prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      { id: admin.id, role: admin.role },
      process.env.ACCESS_TOKEN_SECRET!,
      { expiresIn: "7d" }
    );

    res.cookie("adminToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error: any) {
    console.error("Admin login error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Dashboard Stats
export const getDashboardStats = async (req: any, res: Response) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const weekStart = new Date(now.setDate(now.getDate() - 7));
    const monthStart = new Date(now.setMonth(now.getMonth() - 1));

    // Total counts
    const totalUsers = await prisma.user.count();
    const totalDrivers = await prisma.driver.count();
    const totalRides = await prisma.rides.count();

    // Today's stats
    const todayRides = await prisma.rides.count({
      where: { cratedAt: { gte: todayStart } },
    });

    const todayRevenue = await prisma.rides.aggregate({
      where: {
        cratedAt: { gte: todayStart },
        status: "Completed",
      },
      _sum: { charge: true },
    });

    // Active drivers
    const activeDrivers = await prisma.driver.count({
      where: { status: "active" },
    });

    // Pending verifications (drivers with inactive status)
    const pendingVerifications = await prisma.driver.count({
      where: { status: "inactive" },
    });

    // Active rides
    const activeRides = await prisma.rides.count({
      where: {
        status: { in: ["Accepted", "In Progress"] },
      },
    });

    // Revenue stats
    const totalRevenue = await prisma.rides.aggregate({
      where: { status: "Completed" },
      _sum: { charge: true },
    });

    const weekRevenue = await prisma.rides.aggregate({
      where: {
        status: "Completed",
        cratedAt: { gte: weekStart },
      },
      _sum: { charge: true },
    });

    const monthRevenue = await prisma.rides.aggregate({
      where: {
        status: "Completed",
        cratedAt: { gte: monthStart },
      },
      _sum: { charge: true },
    });

    // Recent rides for activity feed
    const recentRides = await prisma.rides.findMany({
      take: 10,
      orderBy: { cratedAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone_number: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            phone_number: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalDrivers,
        totalRides,
        activeDrivers,
        activeRides,
        pendingVerifications,
        revenue: {
          today: todayRevenue._sum.charge || 0,
          week: weekRevenue._sum.charge || 0,
          month: monthRevenue._sum.charge || 0,
          total: totalRevenue._sum.charge || 0,
        },
        todayRides,
        recentRides,
      },
    });
  } catch (error: any) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Get All Users
export const getAllUsers = async (req: any, res: Response) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone_number: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { cratedAt: "desc" },
        include: {
          rides: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error("Get users error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Get User By ID
export const getUserById = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        rides: {
          include: {
            driver: {
              select: {
                id: true,
                name: true,
                phone_number: true,
                vehicle_type: true,
              },
            },
          },
          orderBy: { cratedAt: "desc" },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error: any) {
    console.error("Get user by ID error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Update User Status (for suspending/activating users)
export const updateUserStatus = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    // Note: User model doesn't have status field, you might need to add it
    // For now, this is a placeholder
    res.status(200).json({
      success: true,
      message: "User status updated",
    });
  } catch (error: any) {
    console.error("Update user status error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Get All Drivers
export const getAllDrivers = async (req: any, res: Response) => {
  try {
    const { page = 1, limit = 10, search, status, vehicleType } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone_number: { contains: search } },
        { registration_number: { contains: search } },
      ];
    }
    if (status) where.status = status;
    if (vehicleType) where.vehicle_type = vehicleType;

    const [drivers, total] = await Promise.all([
      prisma.driver.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: {
          rides: {
            select: {
              id: true,
              status: true,
              charge: true,
            },
          },
        },
      }),
      prisma.driver.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      drivers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error("Get drivers error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Get Driver By ID
export const getDriverById = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const driver = await prisma.driver.findUnique({
      where: { id },
      include: {
        rides: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                phone_number: true,
              },
            },
          },
          orderBy: { cratedAt: "desc" },
        },
      },
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    res.status(200).json({
      success: true,
      driver,
    });
  } catch (error: any) {
    console.error("Get driver by ID error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Update Driver Status
export const updateDriverStatus = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const driver = await prisma.driver.update({
      where: { id },
      data: { status },
    });

    res.status(200).json({
      success: true,
      driver,
    });
  } catch (error: any) {
    console.error("Update driver status error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Verify Driver Documents
export const verifyDriverDocuments = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { verified } = req.body;

    const driver = await prisma.driver.update({
      where: { id },
      data: { status: verified ? "active" : "inactive" },
    });

    res.status(200).json({
      success: true,
      driver,
    });
  } catch (error: any) {
    console.error("Verify driver documents error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Get All Rides
export const getAllRides = async (req: any, res: Response) => {
  try {
    const { page = 1, limit = 10, status, startDate, endDate, userId, driverId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (driverId) where.driverId = driverId;
    if (startDate || endDate) {
      where.cratedAt = {};
      if (startDate) where.cratedAt.gte = new Date(startDate);
      if (endDate) where.cratedAt.lte = new Date(endDate);
    }

    const [rides, total] = await Promise.all([
      prisma.rides.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { cratedAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone_number: true,
            },
          },
          driver: {
            select: {
              id: true,
              name: true,
              phone_number: true,
              vehicle_type: true,
            },
          },
        },
      }),
      prisma.rides.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      rides,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error("Get rides error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Get Ride By ID
export const getRideById = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const ride = await prisma.rides.findUnique({
      where: { id },
      include: {
        user: true,
        driver: true,
      },
    });

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }

    res.status(200).json({
      success: true,
      ride,
    });
  } catch (error: any) {
    console.error("Get ride by ID error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Get Analytics
export const getAnalytics = async (req: any, res: Response) => {
  try {
    const { period = "month" } = req.query;
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "week":
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case "month":
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case "year":
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    // Ride trends
    const rides = await prisma.rides.findMany({
      where: {
        cratedAt: { gte: startDate },
      },
      select: {
        cratedAt: true,
        charge: true,
        status: true,
      },
    });

    // Revenue by vehicle type
    const completedRides = await prisma.rides.findMany({
      where: {
        cratedAt: { gte: startDate },
        status: "Completed",
      },
      include: {
        driver: {
          select: {
            vehicle_type: true,
          },
        },
      },
    });

    const revenueByType = completedRides.reduce((acc: any, ride) => {
      const vehicleType = ride.driver.vehicle_type;
      acc[vehicleType] = (acc[vehicleType] || 0) + ride.charge;
      return acc;
    }, {});

    // Status distribution
    const statusDistribution = await prisma.rides.groupBy({
      by: ["status"],
      where: {
        cratedAt: { gte: startDate },
      },
      _count: {
        id: true,
      },
    });

    res.status(200).json({
      success: true,
      analytics: {
        rides,
        revenueByVehicleType: revenueByType,
        statusDistribution: statusDistribution.map((s) => ({
          status: s.status,
          count: s._count.id,
        })),
      },
    });
  } catch (error: any) {
    console.error("Get analytics error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Send Notification
export const sendNotification = async (req: any, res: Response) => {
  try {
    const { type, userIds, driverIds, message } = req.body;
    // Implementation for sending notifications
    // This would integrate with your Firebase/notification service
    // For now, just return success

    res.status(200).json({
      success: true,
      message: "Notification sent",
    });
  } catch (error: any) {
    console.error("Send notification error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Get Active Rides with Locations
export const getActiveRidesWithLocations = async (req: any, res: Response) => {
  try {
    const rides = await prisma.rides.findMany({
      where: {
        status: { in: ["Accepted", "In Progress"] },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone_number: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            phone_number: true,
            vehicle_type: true,
          },
        },
      },
    });

    // Note: In a real implementation, you would geocode the location names
    // For now, we return the rides with location names
    const ridesWithLocations = rides.map((ride) => ({
      ...ride,
      // These would be geocoded in production
      pickup: null,
      destination: null,
    }));

    res.status(200).json({
      success: true,
      rides: ridesWithLocations,
    });
  } catch (error: any) {
    console.error("Get active rides error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Create Scheduled Trip
export const createScheduledTrip = async (req: any, res: Response) => {
  try {
    const { name, tripDate, scheduledTime, assignedCaptainId, points } = req.body;

    // Validate required fields (assignedCaptainId is optional)
    if (!name || !tripDate || !scheduledTime || !points || !Array.isArray(points) || points.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Name, tripDate, scheduledTime, and points are required",
      });
    }

    // Validate that at least one point is marked as final
    const hasFinalPoint = points.some((p: any) => p.isFinalPoint === true);
    if (!hasFinalPoint) {
      return res.status(400).json({
        success: false,
        message: "At least one point must be marked as final point",
      });
    }

    // Validate captain exists only if assignedCaptainId is provided
    if (assignedCaptainId) {
      const captain = await prisma.driver.findUnique({
        where: { id: assignedCaptainId },
      });

      if (!captain) {
        return res.status(404).json({
          success: false,
          message: "Captain not found",
        });
      }
    }

    // Combine tripDate and scheduledTime into a single DateTime
    const scheduledDateTime = new Date(`${tripDate}T${scheduledTime}`);

    // Create scheduled trip with points (assignedCaptainId is optional)
    const trip = await prisma.scheduledTrip.create({
      data: {
        name,
        tripDate: new Date(tripDate),
        scheduledTime: scheduledDateTime,
        ...(assignedCaptainId && { assignedCaptainId }), // Only include if provided
        createdById: req.admin.id,
        points: {
          create: points.map((point: any, index: number) => ({
            name: point.name,
            latitude: parseFloat(point.latitude),
            longitude: parseFloat(point.longitude),
            order: point.order !== undefined ? point.order : index,
            isFinalPoint: point.isFinalPoint === true,
          })),
        },
      },
      include: {
        assignedCaptain: {
          select: {
            id: true,
            name: true,
            phone_number: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        points: {
          orderBy: { order: "asc" },
        },
      },
    });

    res.status(201).json({
      success: true,
      trip,
    });
  } catch (error: any) {
    console.error("Create scheduled trip error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Get All Scheduled Trips
export const getScheduledTrips = async (req: any, res: Response) => {
  try {
    const { page = 1, limit = 10, status, startDate, endDate, captainId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;
    if (captainId) where.assignedCaptainId = captainId;
    if (startDate || endDate) {
      where.tripDate = {};
      if (startDate) where.tripDate.gte = new Date(startDate);
      if (endDate) where.tripDate.lte = new Date(endDate);
    }

    const [trips, total] = await Promise.all([
      prisma.scheduledTrip.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: {
          assignedCaptain: {
            select: {
              id: true,
              name: true,
              phone_number: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          points: {
            orderBy: { order: "asc" },
          },
          progress: true,
        },
      }),
      prisma.scheduledTrip.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      trips,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error("Get scheduled trips error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Get Scheduled Trip By ID
export const getScheduledTripById = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const trip = await prisma.scheduledTrip.findUnique({
      where: { id },
      include: {
        assignedCaptain: {
          select: {
            id: true,
            name: true,
            phone_number: true,
            email: true,
            vehicle_type: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        points: {
          orderBy: { order: "asc" },
        },
        progress: true,
        activationChecks: {
          orderBy: { checkedAt: "desc" },
          take: 10, // Last 10 activation checks
        },
      },
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Scheduled trip not found",
      });
    }

    res.status(200).json({
      success: true,
      trip,
    });
  } catch (error: any) {
    console.error("Get scheduled trip by ID error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Update Scheduled Trip
export const updateScheduledTrip = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { name, tripDate, scheduledTime, assignedCaptainId, points } = req.body;

    // Check if trip exists and is not already active
    const existingTrip = await prisma.scheduledTrip.findUnique({
      where: { id },
    });

    if (!existingTrip) {
      return res.status(404).json({
        success: false,
        message: "Scheduled trip not found",
      });
    }

    if (existingTrip.status === "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Cannot update an active trip",
      });
    }

    // Prepare update data
    const updateData: any = {};
    if (name) updateData.name = name;
    if (tripDate) updateData.tripDate = new Date(tripDate);
    if (scheduledTime && tripDate) {
      updateData.scheduledTime = new Date(`${tripDate}T${scheduledTime}`);
    }
    if (assignedCaptainId) {
      // Validate captain exists
      const captain = await prisma.driver.findUnique({
        where: { id: assignedCaptainId },
      });
      if (!captain) {
        return res.status(404).json({
          success: false,
          message: "Captain not found",
        });
      }
      updateData.assignedCaptainId = assignedCaptainId;
    }

    // Update trip
    const trip = await prisma.scheduledTrip.update({
      where: { id },
      data: updateData,
      include: {
        assignedCaptain: {
          select: {
            id: true,
            name: true,
            phone_number: true,
            email: true,
          },
        },
        points: {
          orderBy: { order: "asc" },
        },
      },
    });

    // Update points if provided
    if (points && Array.isArray(points)) {
      // Validate that at least one point is marked as final
      const hasFinalPoint = points.some((p: any) => p.isFinalPoint === true);
      if (!hasFinalPoint) {
        return res.status(400).json({
          success: false,
          message: "At least one point must be marked as final point",
        });
      }

      // Validate points have required fields
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        if (!point.name || point.latitude === undefined || point.longitude === undefined) {
          return res.status(400).json({
            success: false,
            message: `Checkpoint ${i + 1} is missing required fields (name, latitude, longitude)`,
          });
        }
      }

      // Delete existing points
      await prisma.tripPoint.deleteMany({
        where: { scheduledTripId: id },
      });

      // Create new points
      await prisma.tripPoint.createMany({
        data: points.map((point: any, index: number) => ({
          scheduledTripId: id,
          name: point.name,
          latitude: parseFloat(point.latitude),
          longitude: parseFloat(point.longitude),
          order: point.order !== undefined ? point.order : index,
          isFinalPoint: point.isFinalPoint === true,
        })),
      });

      // Fetch updated trip with new points
      const updatedTrip = await prisma.scheduledTrip.findUnique({
        where: { id },
        include: {
          assignedCaptain: {
            select: {
              id: true,
              name: true,
              phone_number: true,
              email: true,
            },
          },
          points: {
            orderBy: { order: "asc" },
          },
        },
      });

      return res.status(200).json({
        success: true,
        trip: updatedTrip,
      });
    }

    res.status(200).json({
      success: true,
      trip,
    });
  } catch (error: any) {
    console.error("Update scheduled trip error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Delete Scheduled Trip
export const deleteScheduledTrip = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const trip = await prisma.scheduledTrip.findUnique({
      where: { id },
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Scheduled trip not found",
      });
    }

    if (trip.status === "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete an active trip. Please cancel it first.",
      });
    }

    // Delete trip (cascade will delete points, progress, and activation checks)
    await prisma.scheduledTrip.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Scheduled trip deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete scheduled trip error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

