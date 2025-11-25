require("dotenv").config();
import { Request, Response } from "express";
import prisma from "../utils/prisma";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { applyForceClosedDeduction } from "../services/trip-finance";

type LedgerSummary = {
  totalTrips: number;
  netAmount: number;
  earnings: number;
  deductions: number;
  statusCounts: Record<string, { trips: number; netAmount: number }>;
  ruleBreakdown: Record<string, { trips: number; netAmount: number }>;
};

const summarizeLedgerEntries = (entries: Array<LedgerBase | LedgerWithTrip>): LedgerSummary => {
  return entries.reduce<LedgerSummary>(
    (acc, entry) => {
      const net = entry.netAmount ?? 0;
      const statusKey = entry.statusAtCalculation || "UNKNOWN";
      const ruleKey = entry.rule || "NONE";

      acc.totalTrips += 1;
      acc.netAmount += net;
      acc.statusCounts[statusKey] = acc.statusCounts[statusKey] || { trips: 0, netAmount: 0 };
      acc.ruleBreakdown[ruleKey] = acc.ruleBreakdown[ruleKey] || { trips: 0, netAmount: 0 };

      acc.statusCounts[statusKey].trips += 1;
      acc.statusCounts[statusKey].netAmount += net;
      acc.ruleBreakdown[ruleKey].trips += 1;
      acc.ruleBreakdown[ruleKey].netAmount += net;

      if (net >= 0) {
        acc.earnings += net;
      } else {
        acc.deductions += net;
      }

      return acc;
    },
    {
      totalTrips: 0,
      netAmount: 0,
      earnings: 0,
      deductions: 0,
      statusCounts: {},
      ruleBreakdown: {},
    }
  );
};

const normalizeRange = (start: Date, end: Date) => {
  const normalizedStart = new Date(start);
  normalizedStart.setHours(0, 0, 0, 0);

  const normalizedEnd = new Date(end);
  normalizedEnd.setHours(23, 59, 59, 999);

  if (normalizedStart > normalizedEnd) {
    throw new Error("Start date must be before end date");
  }

  return { start: normalizedStart, end: normalizedEnd };
};

const ledgerTripInclude = {
  scheduledTrip: {
    select: {
      id: true,
      name: true,
      tripDate: true,
      scheduledTime: true,
      status: true,
      price: true,
      financialRule: true,
      financialAdjustment: true,
      netAmount: true,
      company: {
        select: { id: true, name: true },
      },
      assignedCaptain: {
        select: {
          id: true,
          name: true,
          phone_number: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.ScheduledTripLedgerInclude;

type LedgerWithTrip = Prisma.ScheduledTripLedgerGetPayload<{ include: typeof ledgerTripInclude }>;
type LedgerBase = Prisma.ScheduledTripLedgerGetPayload<{ include: {} }>;

const fetchLedgerEntries = async (params: { start: Date; end: Date }) => {
  const { start, end } = params;

  return prisma.scheduledTripLedger.findMany({
    where: {
      calculatedAt: {
        gte: start,
        lte: end,
      },
    },
    orderBy: { calculatedAt: "asc" },
  });
};

const fetchLedgerEntriesWithTrips = async (params: { start: Date; end: Date }) => {
  const { start, end } = params;

  return prisma.scheduledTripLedger.findMany({
    where: {
      calculatedAt: {
        gte: start,
        lte: end,
      },
    },
    orderBy: { calculatedAt: "asc" },
    include: ledgerTripInclude,
  });
};

const buildRangeBounds = (startInput?: string, endInput?: string) => {
  if (!startInput || !endInput) {
    throw new Error("Start date and end date are required");
  }

  const startDate = new Date(startInput);
  const endDate = new Date(endInput);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error("Invalid date values");
  }

  return normalizeRange(startDate, endDate);
};

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
      include: {
        company: true,
      },
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
      { id: admin.id, role: admin.role, companyId: admin.companyId },
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
        companyId: admin.companyId,
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

    // Emergency terminated trips count
    const emergencyTerminatedTrips = await prisma.scheduledTrip.count({
      where: { status: { in: ["EMERGENCY_TERMINATED", "EMERGENCY_ENDED"] } },
    });

    // Emergency terminations today
    const todayStartForEmergency = new Date();
    todayStartForEmergency.setHours(0, 0, 0, 0);
    const tomorrowForEmergency = new Date(todayStartForEmergency);
    tomorrowForEmergency.setDate(tomorrowForEmergency.getDate() + 1);
    
    const emergencyTerminationsToday = await prisma.emergencyUsage.count({
      where: {
        usedAt: {
          gte: todayStartForEmergency,
          lt: tomorrowForEmergency,
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
        emergencyTerminatedTrips,
        emergencyTerminationsToday,
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
    const { page = 1, limit = 10, search, status, vehicleType, includeAll } = req.query;
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
    // Only filter by status if includeAll is not true and status is provided
    if (status && includeAll !== "true") where.status = status;
    if (vehicleType) where.vehicle_type = vehicleType;

    // Filter by company if user is COMPANY role
    if (req.admin && req.admin.role === "COMPANY" && req.admin.companyId) {
      const companyDrivers = await prisma.driverCompany.findMany({
        where: { companyId: req.admin.companyId },
        select: { driverId: true },
      });
      const driverIds = companyDrivers.map((dc) => dc.driverId);
      where.id = { in: driverIds };
    }

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

// Companies
export const getCompanies = async (req: any, res: Response) => {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { name: "asc" },
    });

    res.status(200).json({
      success: true,
      companies,
    });
  } catch (error: any) {
    console.error("Get companies error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const createCompany = async (req: any, res: Response) => {
  try {
    const { name, defaultScheduledTripPrice } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Company name is required",
      });
    }

    const price = parseFloat(defaultScheduledTripPrice);
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({
        success: false,
        message: "Default scheduled trip price must be a positive number",
      });
    }

    const existing = await prisma.company.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A company with this name already exists",
      });
    }

    const company = await prisma.company.create({
      data: {
        name,
        defaultScheduledTripPrice: price,
      },
    });

    res.status(201).json({
      success: true,
      company,
    });
  } catch (error: any) {
    console.error("Create company error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateCompany = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { name, defaultScheduledTripPrice } = req.body;

    const company = await prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    const data: any = {};
    if (name) {
      data.name = name;
    }

    if (defaultScheduledTripPrice !== undefined) {
      const price = parseFloat(defaultScheduledTripPrice);
      if (isNaN(price) || price <= 0) {
        return res.status(400).json({
          success: false,
          message: "Default scheduled trip price must be a positive number",
        });
      }
      data.defaultScheduledTripPrice = price;
    }

    const updatedCompany = await prisma.company.update({
      where: { id },
      data,
    });

    res.status(200).json({
      success: true,
      company: updatedCompany,
    });
  } catch (error: any) {
    console.error("Update company error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const deleteCompany = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const company = await prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    const linkedTrips = await prisma.scheduledTrip.count({
      where: { companyId: id },
    });

    if (linkedTrips > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete company with scheduled trips",
      });
    }

    await prisma.company.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Company deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete company error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Company Account Management Functions

// Create Company Account
export const createCompanyAccount = async (req: any, res: Response) => {
  try {
    const { name, email, password, companyId } = req.body;

    if (!name || !email || !password || !companyId) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password, and companyId are required",
      });
    }

    // Check if company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    // Check if email already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create company account (Admin with COMPANY role)
    const companyAccount = await prisma.admin.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "COMPANY",
        companyId,
      },
      include: {
        company: true,
      },
    });

    res.status(201).json({
      success: true,
      companyAccount: {
        id: companyAccount.id,
        name: companyAccount.name,
        email: companyAccount.email,
        role: companyAccount.role,
        companyId: companyAccount.companyId,
        company: companyAccount.company,
      },
    });
  } catch (error: any) {
    console.error("Create company account error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Get All Company Accounts
export const getCompanyAccounts = async (req: any, res: Response) => {
  try {
    const companyAccounts = await prisma.admin.findMany({
      where: {
        role: "COMPANY",
      },
      include: {
        company: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      companyAccounts: companyAccounts.map((account) => ({
        id: account.id,
        name: account.name,
        email: account.email,
        role: account.role,
        companyId: account.companyId,
        company: account.company,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error("Get company accounts error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Update Company Account
export const updateCompanyAccount = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, password, companyId } = req.body;

    const companyAccount = await prisma.admin.findUnique({
      where: { id },
    });

    if (!companyAccount) {
      return res.status(404).json({
        success: false,
        message: "Company account not found",
      });
    }

    if (companyAccount.role !== "COMPANY") {
      return res.status(400).json({
        success: false,
        message: "This account is not a company account",
      });
    }

    const data: any = {};

    if (name) {
      data.name = name;
    }

    if (email && email !== companyAccount.email) {
      // Check if email is already taken
      const existingAdmin = await prisma.admin.findUnique({
        where: { email },
      });

      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: "An account with this email already exists",
        });
      }

      data.email = email;
    }

    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    if (companyId) {
      // Verify company exists
      const company = await prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        return res.status(404).json({
          success: false,
          message: "Company not found",
        });
      }

      data.companyId = companyId;
    }

    const updatedAccount = await prisma.admin.update({
      where: { id },
      data,
      include: {
        company: true,
      },
    });

    res.status(200).json({
      success: true,
      companyAccount: {
        id: updatedAccount.id,
        name: updatedAccount.name,
        email: updatedAccount.email,
        role: updatedAccount.role,
        companyId: updatedAccount.companyId,
        company: updatedAccount.company,
      },
    });
  } catch (error: any) {
    console.error("Update company account error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Delete Company Account
export const deleteCompanyAccount = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const companyAccount = await prisma.admin.findUnique({
      where: { id },
    });

    if (!companyAccount) {
      return res.status(404).json({
        success: false,
        message: "Company account not found",
      });
    }

    if (companyAccount.role !== "COMPANY") {
      return res.status(400).json({
        success: false,
        message: "This account is not a company account",
      });
    }

    await prisma.admin.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Company account deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete company account error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Assign Drivers to Company
export const assignDriversToCompany = async (req: any, res: Response) => {
  try {
    const { id } = req.params; // companyId
    const { driverIds } = req.body; // Array of driver IDs

    if (!driverIds || !Array.isArray(driverIds)) {
      return res.status(400).json({
        success: false,
        message: "driverIds must be an array",
      });
    }

    // Verify company exists
    const company = await prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    // Verify all drivers exist
    const drivers = await prisma.driver.findMany({
      where: {
        id: { in: driverIds },
      },
    });

    if (drivers.length !== driverIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more drivers not found",
      });
    }

    // Get existing assignments for this company
    const existingAssignments = await prisma.driverCompany.findMany({
      where: { companyId: id },
      select: { driverId: true },
    });

    const existingDriverIds = existingAssignments.map((a) => a.driverId);
    
    // Determine which drivers to add and which to remove
    const driversToAdd = driverIds.filter((driverId) => !existingDriverIds.includes(driverId));
    const driversToRemove = existingDriverIds.filter((driverId) => !driverIds.includes(driverId));

    // Use a transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Remove drivers that are no longer assigned
      if (driversToRemove.length > 0) {
        await tx.driverCompany.deleteMany({
          where: {
            companyId: id,
            driverId: { in: driversToRemove },
          },
        });
      }

      // Add new assignments (only for drivers that don't already exist)
      if (driversToAdd.length > 0) {
        const newAssignments = driversToAdd.map((driverId: string) => ({
          driverId,
          companyId: id,
        }));

        await tx.driverCompany.createMany({
          data: newAssignments,
        });
      }
    });

    const changes = [];
    if (driversToAdd.length > 0) {
      changes.push(`added ${driversToAdd.length} driver(s)`);
    }
    if (driversToRemove.length > 0) {
      changes.push(`removed ${driversToRemove.length} driver(s)`);
    }
    if (changes.length === 0) {
      changes.push("no changes needed");
    }

    res.status(200).json({
      success: true,
      message: `Successfully updated driver assignments: ${changes.join(", ")}. Total: ${driverIds.length} driver(s) assigned to company`,
    });
  } catch (error: any) {
    console.error("Assign drivers to company error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Get Company Drivers
export const getCompanyDrivers = async (req: any, res: Response) => {
  try {
    const { id } = req.params; // companyId

    // Verify company exists
    const company = await prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    // Get all drivers assigned to this company
    const driverCompanies = await prisma.driverCompany.findMany({
      where: { companyId: id },
      include: {
        driver: true,
      },
    });

    const drivers = driverCompanies.map((dc) => dc.driver);

    res.status(200).json({
      success: true,
      drivers,
    });
  } catch (error: any) {
    console.error("Get company drivers error:", error);
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

    // Filter by company if user is COMPANY role
    if (req.admin && req.admin.role === "COMPANY" && req.admin.companyId) {
      const companyDrivers = await prisma.driverCompany.findMany({
        where: { companyId: req.admin.companyId },
        select: { driverId: true },
      });
      const driverIds = companyDrivers.map((dc) => dc.driverId);
      if (where.driverId) {
        // If driverId is already specified, check if it's in company drivers
        if (!driverIds.includes(where.driverId)) {
          return res.status(200).json({
            success: true,
            rides: [],
            pagination: {
              page: Number(page),
              limit: Number(limit),
              total: 0,
              pages: 0,
            },
          });
        }
      } else {
        where.driverId = { in: driverIds };
      }
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
    const where: any = {
      status: { in: ["Accepted", "In Progress"] },
    };

    // Filter by company if user is COMPANY role
    if (req.admin && req.admin.role === "COMPANY" && req.admin.companyId) {
      const companyDrivers = await prisma.driverCompany.findMany({
        where: { companyId: req.admin.companyId },
        select: { driverId: true },
      });
      const driverIds = companyDrivers.map((dc) => dc.driverId);
      where.driverId = { in: driverIds };
    }

    const rides = await prisma.rides.findMany({
      where,
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
    const {
      name,
      tripDate,
      scheduledTime,
      assignedCaptainId,
      points,
      companyId,
      price,
      tripType,
    } = req.body;

    if (
      !name ||
      !tripDate ||
      !scheduledTime ||
      !companyId ||
      !points ||
      !Array.isArray(points) ||
      points.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, tripDate, scheduledTime, companyId, and points are required",
      });
    }

    // Validate tripType
    if (tripType && tripType !== "ARRIVAL" && tripType !== "DEPARTURE") {
      return res.status(400).json({
        success: false,
        message: "tripType must be either 'ARRIVAL' or 'DEPARTURE'",
      });
    }

    const hasFinalPoint = points.some((p: any) => p.isFinalPoint === true);
    if (!hasFinalPoint) {
      return res.status(400).json({
        success: false,
        message: "At least one point must be marked as final point",
      });
    }

    // For ARRIVAL trips, validate that all checkpoints have expectedTime
    const isArrivalTrip = tripType === "ARRIVAL";
    if (isArrivalTrip) {
      const missingExpectedTimes = points.filter(
        (p: any) => !p.expectedTime || p.expectedTime.trim() === ""
      );
      if (missingExpectedTimes.length > 0) {
        return res.status(400).json({
          success: false,
          message: "For Arrival trips, all checkpoints must have an expected time",
        });
      }
    }

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

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    const resolvedPrice =
      price !== undefined && price !== null ? parseFloat(price) : company.defaultScheduledTripPrice;

    if (isNaN(resolvedPrice) || resolvedPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Trip price must be a positive number",
      });
    }

    const scheduledDateTime = new Date(`${tripDate}T${scheduledTime}`);

    const trip = await prisma.scheduledTrip.create({
      data: {
        name,
        tripDate: new Date(tripDate),
        scheduledTime: scheduledDateTime,
        ...(tripType && { tripType }),
        ...(assignedCaptainId && { assignedCaptainId }),
        createdById: req.admin.id,
        companyId,
        price: resolvedPrice,
        points: {
          create: points.map((point: any, index: number) => {
            // Parse expectedTime if provided
            let expectedTimeValue = null;
            if (point.expectedTime) {
              // expectedTime comes as "HH:MM" format, combine with tripDate
              // Store without "Z" suffix so it's interpreted in server timezone
              // This ensures the time stored represents the local time entered by the user
              const [hours, minutes] = point.expectedTime.split(':');
              // Create date string without "Z" - will be interpreted in server timezone
              // Both expectedTime and reachedAt will be compared in UTC (via getTime())
              const dateTimeString = `${tripDate}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
              expectedTimeValue = new Date(dateTimeString);
            }

            return {
              name: point.name,
              latitude: parseFloat(point.latitude),
              longitude: parseFloat(point.longitude),
              order: point.order !== undefined ? point.order : index,
              isFinalPoint: point.isFinalPoint === true,
              ...(expectedTimeValue && { expectedTime: expectedTimeValue }),
            };
          }),
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
        company: true,
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
    const { page = 1, limit = 10, status, startDate, endDate, captainId, companyId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;
    if (captainId) where.assignedCaptainId = captainId;
    if (companyId) where.companyId = companyId;
    if (startDate || endDate) {
      where.tripDate = {};
      if (startDate) where.tripDate.gte = new Date(startDate);
      if (endDate) where.tripDate.lte = new Date(endDate);
    }

    // Filter by company if user is COMPANY role
    if (req.admin && req.admin.role === "COMPANY" && req.admin.companyId) {
      where.companyId = req.admin.companyId;
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
        company: true,
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

export const getScheduledTripEarningsSummary = async (req: any, res: Response) => {
  try {
    const today = new Date();
    const todayBounds = normalizeRange(today, today);

    const lastTwoWeeksStart = new Date(today);
    lastTwoWeeksStart.setDate(lastTwoWeeksStart.getDate() - 13);
    const lastTwoWeeksBounds = normalizeRange(lastTwoWeeksStart, today);

    const [todayEntries, lastTwoWeeksEntries] = await Promise.all([
      fetchLedgerEntries({ start: todayBounds.start, end: todayBounds.end }),
      fetchLedgerEntries({ start: lastTwoWeeksBounds.start, end: lastTwoWeeksBounds.end }),
    ]);

    const todaySummary = summarizeLedgerEntries(todayEntries);
    const lastTwoWeeksSummary = summarizeLedgerEntries(lastTwoWeeksEntries);

    res.status(200).json({
      success: true,
      summary: {
        today: {
          range: {
            start: todayBounds.start.toISOString(),
            end: todayBounds.end.toISOString(),
          },
          ...todaySummary,
        },
        lastTwoWeeks: {
          range: {
            start: lastTwoWeeksBounds.start.toISOString(),
            end: lastTwoWeeksBounds.end.toISOString(),
          },
          ...lastTwoWeeksSummary,
        },
      },
    });
  } catch (error: any) {
    console.error("Get scheduled trip summary error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const getScheduledTripEarningsRange = async (req: any, res: Response) => {
  try {
    const { startDate, endDate, includeTrips } = req.query;

    let bounds;
    try {
      bounds = buildRangeBounds(startDate as string, endDate as string);
    } catch (rangeError: any) {
      return res.status(400).json({
        success: false,
        message: rangeError.message || "Invalid date range",
      });
    }

    const includeTripsFlag = includeTrips === "true";
    const entries = includeTripsFlag
      ? await fetchLedgerEntriesWithTrips({
          start: bounds.start,
          end: bounds.end,
        })
      : await fetchLedgerEntries({
          start: bounds.start,
          end: bounds.end,
        });
    const summary = summarizeLedgerEntries(entries);
    const summaryWithRange = {
      range: {
        start: bounds.start.toISOString(),
        end: bounds.end.toISOString(),
      },
      ...summary,
    };

    res.status(200).json({
      success: true,
      range: {
        start: bounds.start.toISOString(),
        end: bounds.end.toISOString(),
      },
      summary: summaryWithRange,
      entries: includeTripsFlag ? entries : undefined,
    });
  } catch (error: any) {
    console.error("Get scheduled trip earnings range error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const getScheduledTripInvoice = async (req: any, res: Response) => {
  try {
    const { startDate, endDate } = req.body;

    let bounds;
    try {
      bounds = buildRangeBounds(startDate, endDate);
    } catch (rangeError: any) {
      return res.status(400).json({
        success: false,
        message: rangeError.message || "Invalid date range",
      });
    }

    const entries = await fetchLedgerEntriesWithTrips({
      start: bounds.start,
      end: bounds.end,
    });

    const summary = summarizeLedgerEntries(entries);
    const totals = {
      range: {
        start: bounds.start.toISOString(),
        end: bounds.end.toISOString(),
      },
      ...summary,
    };
    const invoice = {
      range: {
        start: bounds.start.toISOString(),
        end: bounds.end.toISOString(),
      },
      totals,
      completedTrips: summary.statusCounts.COMPLETED?.trips || 0,
      failedTrips: summary.statusCounts.FAILED?.trips || 0,
      emergencyTrips:
        (summary.statusCounts.EMERGENCY_ENDED?.trips || 0) +
        (summary.statusCounts.EMERGENCY_TERMINATED?.trips || 0),
      lineItems: entries.map((entry) => ({
        ledgerId: entry.id,
        tripId: entry.scheduledTripId,
        tripName: entry.scheduledTrip?.name,
        status: entry.statusAtCalculation,
        rule: entry.rule,
        price: entry.scheduledTrip?.price ?? 0,
        netAmount: entry.netAmount,
        calculatedAt: entry.calculatedAt,
        captain: entry.scheduledTrip?.assignedCaptain,
        company: entry.scheduledTrip?.company,
      })),
    };

    res.status(200).json({
      success: true,
      invoice,
    });
  } catch (error: any) {
    console.error("Get scheduled trip invoice error:", error);
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
        company: true,
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
    const { name, tripDate, scheduledTime, assignedCaptainId, points, companyId, price, tripType } = req.body;

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

    if (
      existingTrip.status === "ACTIVE" ||
      existingTrip.status === "EMERGENCY_TERMINATED" ||
      existingTrip.status === "EMERGENCY_ENDED"
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot update a trip with status: ${existingTrip.status}`,
      });
    }

    // Validate tripType if provided
    if (tripType && tripType !== "ARRIVAL" && tripType !== "DEPARTURE") {
      return res.status(400).json({
        success: false,
        message: "tripType must be either 'ARRIVAL' or 'DEPARTURE'",
      });
    }

    // Prepare update data
    const updateData: any = {};
    if (name) updateData.name = name;
    if (tripDate) updateData.tripDate = new Date(tripDate);
    if (scheduledTime && tripDate) {
      updateData.scheduledTime = new Date(`${tripDate}T${scheduledTime}`);
    }
    if (tripType) updateData.tripType = tripType;
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

    let resolvedPrice: number | undefined;

    if (companyId) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        return res.status(404).json({
          success: false,
          message: "Company not found",
        });
      }

      updateData.companyId = companyId;
      resolvedPrice = company.defaultScheduledTripPrice;
    }

    if (price !== undefined && price !== null) {
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: "Trip price must be a positive number",
        });
      }
      resolvedPrice = parsedPrice;
    }

    if (resolvedPrice !== undefined) {
      updateData.price = resolvedPrice;
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
        company: true,
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

      // Get current trip type (use updated value if provided, otherwise existing)
      const currentTripType = tripType || existingTrip.tripType;

      // For ARRIVAL trips, validate that all checkpoints have expectedTime
      if (currentTripType === "ARRIVAL") {
        const missingExpectedTimes = points.filter(
          (p: any) => !p.expectedTime || p.expectedTime.trim() === ""
        );
        if (missingExpectedTimes.length > 0) {
          return res.status(400).json({
            success: false,
            message: "For Arrival trips, all checkpoints must have an expected time",
          });
        }
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

      // Get the trip date for expectedTime calculation
      const tripDateForPoints = tripDate || existingTrip.tripDate;

      // Create new points
      await prisma.tripPoint.createMany({
        data: points.map((point: any, index: number) => {
          // Parse expectedTime if provided
          let expectedTimeValue = null;
          if (point.expectedTime) {
            // expectedTime comes as "HH:MM" format, combine with tripDate
            // Store without "Z" suffix so it's interpreted in server timezone
            // This ensures the time stored represents the local time entered by the user
            const tripDateStr = tripDateForPoints instanceof Date 
              ? tripDateForPoints.toISOString().split('T')[0]
              : tripDateForPoints;
            const [hours, minutes] = point.expectedTime.split(':');
            // Create date string without "Z" - will be interpreted in server timezone
            // Both expectedTime and reachedAt will be compared in UTC (via getTime())
            const dateTimeString = `${tripDateStr}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
            expectedTimeValue = new Date(dateTimeString);
          }

          return {
            scheduledTripId: id,
            name: point.name,
            latitude: parseFloat(point.latitude),
            longitude: parseFloat(point.longitude),
            order: point.order !== undefined ? point.order : index,
            isFinalPoint: point.isFinalPoint === true,
            ...(expectedTimeValue && { expectedTime: expectedTimeValue }),
          };
        }),
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
          company: true,
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

    if (
      trip.status === "ACTIVE" ||
      trip.status === "EMERGENCY_TERMINATED" ||
      trip.status === "EMERGENCY_ENDED"
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete a trip with status: ${trip.status}`,
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

// Force Close Trip
export const forceCloseTrip = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    // Check if trip exists
    const trip = await prisma.scheduledTrip.findUnique({
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
      },
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Scheduled trip not found",
      });
    }

    // Validate trip status is ACTIVE
    if (trip.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: `Cannot force close a trip with status: ${trip.status}. Only ACTIVE trips can be force closed.`,
      });
    }

    // Validate trip has assigned captain
    if (!trip.assignedCaptainId) {
      return res.status(400).json({
        success: false,
        message: "Cannot force close a trip without an assigned captain",
      });
    }

    // Update trip status to FORCE_CLOSED
    const updatedTrip = await prisma.scheduledTrip.update({
      where: { id },
      data: {
        status: "FORCE_CLOSED",
      },
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
          take: 10,
        },
        company: true,
      },
    });

    // Apply financial deduction
    const financeResult = await applyForceClosedDeduction(id);

    if (!financeResult.success) {
      console.error("Failed to apply force closed deduction:", financeResult.reason);
      // Note: Trip status is already updated, but financial deduction failed
      // This is logged but we still return success since the status change succeeded
    }

    // Fetch updated trip with financial data
    const tripWithFinance = await prisma.scheduledTrip.findUnique({
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
          take: 10,
        },
        company: true,
      },
    });

    res.status(200).json({
      success: true,
      trip: tripWithFinance,
      message: "Trip force closed successfully",
    });
  } catch (error: any) {
    console.error("Force close trip error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// Get Emergency Usage Logs
export const getEmergencyLogs = async (req: any, res: Response) => {
  try {
    const { page = 1, limit = 20, driverId, startDate, endDate } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (driverId) where.driverId = driverId;
    if (startDate || endDate) {
      where.usedAt = {};
      if (startDate) where.usedAt.gte = new Date(startDate);
      if (endDate) where.usedAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.emergencyUsage.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { usedAt: "desc" },
        include: {
          driver: {
            select: {
              id: true,
              name: true,
              phone_number: true,
              email: true,
            },
          },
        },
      }),
      prisma.emergencyUsage.count({ where }),
    ]);

    // Get trip details for each log
    const logsWithTrips = await Promise.all(
      logs.map(async (log) => {
        const trip = await prisma.scheduledTrip.findUnique({
          where: { id: log.tripId },
          select: {
            id: true,
            name: true,
            status: true,
            emergencyTerminatedAt: true,
          },
        });
        return {
          ...log,
          trip,
        };
      })
    );

    res.status(200).json({
      success: true,
      logs: logsWithTrips,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error("Get emergency logs error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

