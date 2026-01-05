require("dotenv").config();
import { Request, Response } from "express";
import prisma from "../utils/prisma";
import bcrypt from "bcryptjs";

// ==================== SCHOOLS ====================

export const getSchools = async (req: any, res: Response) => {
  try {
    const schools = await prisma.school.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            routes: true,
            students: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      schools,
    });
  } catch (error: any) {
    console.error("Get schools error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const getSchoolById = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const school = await prisma.school.findUnique({
      where: { id },
      include: {
        routes: {
          include: {
            _count: {
              select: {
                stops: true,
              },
            },
          },
        },
        students: true,
      },
    });

    if (!school) {
      return res.status(404).json({
        success: false,
        message: "School not found",
      });
    }

    res.status(200).json({
      success: true,
      school,
    });
  } catch (error: any) {
    console.error("Get school error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const createSchool = async (req: any, res: Response) => {
  try {
    const { name, address, phoneNumber, email } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "School name is required",
      });
    }

    const existing = await prisma.school.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A school with this name already exists",
      });
    }

    const school = await prisma.school.create({
      data: {
        name,
        address: address || null,
        phoneNumber: phoneNumber || null,
        email: email || null,
      },
    });

    res.status(201).json({
      success: true,
      school,
    });
  } catch (error: any) {
    console.error("Create school error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateSchool = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { name, address, phoneNumber, email } = req.body;

    const school = await prisma.school.findUnique({
      where: { id },
    });

    if (!school) {
      return res.status(404).json({
        success: false,
        message: "School not found",
      });
    }

    const data: any = {};
    if (name) data.name = name;
    if (address !== undefined) data.address = address;
    if (phoneNumber !== undefined) data.phoneNumber = phoneNumber;
    if (email !== undefined) data.email = email;

    const updatedSchool = await prisma.school.update({
      where: { id },
      data,
    });

    res.status(200).json({
      success: true,
      school: updatedSchool,
    });
  } catch (error: any) {
    console.error("Update school error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const deleteSchool = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const school = await prisma.school.findUnique({
      where: { id },
    });

    if (!school) {
      return res.status(404).json({
        success: false,
        message: "School not found",
      });
    }

    const linkedRoutes = await prisma.route.count({
      where: { schoolId: id },
    });

    if (linkedRoutes > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete school with routes. Please delete routes first.",
      });
    }

    await prisma.school.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "School deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete school error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// ==================== ROUTES ====================

export const getRoutes = async (req: any, res: Response) => {
  try {
    const { schoolId } = req.query;

    const where: any = {};
    if (schoolId) {
      where.schoolId = schoolId;
    }

    const routes = await prisma.route.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        school: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            stops: true,
            trips: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      routes,
    });
  } catch (error: any) {
    console.error("Get routes error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const getRouteById = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const route = await prisma.route.findUnique({
      where: { id },
      include: {
        school: true,
        stops: {
          orderBy: { order: "asc" },
          include: {
            _count: {
              select: {
                students: true,
              },
            },
          },
        },
      },
    });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: "Route not found",
      });
    }

    res.status(200).json({
      success: true,
      route,
    });
  } catch (error: any) {
    console.error("Get route error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const createRoute = async (req: any, res: Response) => {
  try {
    const { schoolId, name, description } = req.body;

    if (!schoolId || !name) {
      return res.status(400).json({
        success: false,
        message: "School ID and route name are required",
      });
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      return res.status(404).json({
        success: false,
        message: "School not found",
      });
    }

    const route = await prisma.route.create({
      data: {
        schoolId,
        name,
        description: description || null,
      },
    });

    res.status(201).json({
      success: true,
      route,
    });
  } catch (error: any) {
    console.error("Create route error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateRoute = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const route = await prisma.route.findUnique({
      where: { id },
    });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: "Route not found",
      });
    }

    const data: any = {};
    if (name) data.name = name;
    if (description !== undefined) data.description = description;

    const updatedRoute = await prisma.route.update({
      where: { id },
      data,
    });

    res.status(200).json({
      success: true,
      route: updatedRoute,
    });
  } catch (error: any) {
    console.error("Update route error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const deleteRoute = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const route = await prisma.route.findUnique({
      where: { id },
    });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: "Route not found",
      });
    }

    const linkedTrips = await prisma.scheduledTrip.count({
      where: { routeId: id },
    });

    if (linkedTrips > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete route with scheduled trips",
      });
    }

    await prisma.route.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Route deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete route error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// ==================== STOPS ====================

export const getStops = async (req: any, res: Response) => {
  try {
    const { routeId } = req.query;

    const where: any = {};
    if (routeId) {
      where.routeId = routeId;
    }

    const stops = await prisma.stop.findMany({
      where,
      orderBy: { order: "asc" },
      include: {
        route: {
          select: {
            id: true,
            name: true,
            school: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            students: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      stops,
    });
  } catch (error: any) {
    console.error("Get stops error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const getStopById = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const stop = await prisma.stop.findUnique({
      where: { id },
      include: {
        route: {
          include: {
            school: true,
          },
        },
        students: true,
      },
    });

    if (!stop) {
      return res.status(404).json({
        success: false,
        message: "Stop not found",
      });
    }

    res.status(200).json({
      success: true,
      stop,
    });
  } catch (error: any) {
    console.error("Get stop error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const createStop = async (req: any, res: Response) => {
  try {
    const { routeId, name, latitude, longitude, order } = req.body;

    if (!routeId || !name || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        message: "Route ID, name, latitude, and longitude are required",
      });
    }

    const route = await prisma.route.findUnique({
      where: { id: routeId },
    });

    if (!route) {
      return res.status(404).json({
        success: false,
        message: "Route not found",
      });
    }

    // Get max order if not provided
    let stopOrder = order;
    if (stopOrder === undefined) {
      const maxOrder = await prisma.stop.findFirst({
        where: { routeId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      stopOrder = maxOrder ? maxOrder.order + 1 : 0;
    }

    const stop = await prisma.stop.create({
      data: {
        routeId,
        name,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        order: stopOrder,
      },
    });

    res.status(201).json({
      success: true,
      stop,
    });
  } catch (error: any) {
    console.error("Create stop error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateStop = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { name, latitude, longitude, order } = req.body;

    const stop = await prisma.stop.findUnique({
      where: { id },
    });

    if (!stop) {
      return res.status(404).json({
        success: false,
        message: "Stop not found",
      });
    }

    const data: any = {};
    if (name) data.name = name;
    if (latitude !== undefined) data.latitude = parseFloat(latitude);
    if (longitude !== undefined) data.longitude = parseFloat(longitude);
    if (order !== undefined) data.order = parseInt(order);

    const updatedStop = await prisma.stop.update({
      where: { id },
      data,
    });

    res.status(200).json({
      success: true,
      stop: updatedStop,
    });
  } catch (error: any) {
    console.error("Update stop error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const deleteStop = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const stop = await prisma.stop.findUnique({
      where: { id },
    });

    if (!stop) {
      return res.status(404).json({
        success: false,
        message: "Stop not found",
      });
    }

    const linkedStudents = await prisma.student.count({
      where: { stopId: id },
    });

    if (linkedStudents > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete stop with assigned students. Please reassign students first.",
      });
    }

    await prisma.stop.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Stop deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete stop error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// ==================== STUDENTS ====================

export const getStudents = async (req: any, res: Response) => {
  try {
    const { schoolId, stopId } = req.query;

    const where: any = {};
    if (schoolId) {
      where.schoolId = schoolId;
    }
    if (stopId) {
      where.stopId = stopId;
    }

    const students = await prisma.student.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: {
        school: {
          select: {
            id: true,
            name: true,
          },
        },
        stop: {
          select: {
            id: true,
            name: true,
            route: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            parents: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      students,
    });
  } catch (error: any) {
    console.error("Get students error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const getStudentById = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        school: true,
        stop: {
          include: {
            route: {
              include: {
                school: true,
              },
            },
          },
        },
        parents: {
          include: {
            parent: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phoneNumber: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    res.status(200).json({
      success: true,
      student,
    });
  } catch (error: any) {
    console.error("Get student error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const createStudent = async (req: any, res: Response) => {
  try {
    const { schoolId, stopId, firstName, lastName, grade, studentId, photo } =
      req.body;

    if (!schoolId || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: "School ID, first name, and last name are required",
      });
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      return res.status(404).json({
        success: false,
        message: "School not found",
      });
    }

    if (stopId) {
      const stop = await prisma.stop.findUnique({
        where: { id: stopId },
      });

      if (!stop) {
        return res.status(404).json({
          success: false,
          message: "Stop not found",
        });
      }
    }

    const student = await prisma.student.create({
      data: {
        schoolId,
        stopId: stopId || null,
        firstName,
        lastName,
        grade: grade || null,
        studentId: studentId || null,
        photo: photo || null,
      },
    });

    res.status(201).json({
      success: true,
      student,
    });
  } catch (error: any) {
    console.error("Create student error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateStudent = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { stopId, firstName, lastName, grade, studentId, photo } = req.body;

    const student = await prisma.student.findUnique({
      where: { id },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const data: any = {};
    if (stopId !== undefined) {
      if (stopId) {
        const stop = await prisma.stop.findUnique({
          where: { id: stopId },
        });
        if (!stop) {
          return res.status(404).json({
            success: false,
            message: "Stop not found",
          });
        }
      }
      data.stopId = stopId || null;
    }
    if (firstName) data.firstName = firstName;
    if (lastName) data.lastName = lastName;
    if (grade !== undefined) data.grade = grade;
    if (studentId !== undefined) data.studentId = studentId;
    if (photo !== undefined) data.photo = photo;

    const updatedStudent = await prisma.student.update({
      where: { id },
      data,
    });

    res.status(200).json({
      success: true,
      student: updatedStudent,
    });
  } catch (error: any) {
    console.error("Update student error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const deleteStudent = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const student = await prisma.student.findUnique({
      where: { id },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    await prisma.student.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Student deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete student error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// ==================== PARENTS ====================

export const getParents = async (req: any, res: Response) => {
  try {
    const parents = await prisma.parent.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: {
        _count: {
          select: {
            students: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      parents,
    });
  } catch (error: any) {
    console.error("Get parents error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const getParentById = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const parent = await prisma.parent.findUnique({
      where: { id },
      include: {
        students: {
          include: {
            student: {
              include: {
                school: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                stop: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    res.status(200).json({
      success: true,
      parent,
    });
  } catch (error: any) {
    console.error("Get parent error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateParent = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phoneNumber, email } = req.body;

    const parent = await prisma.parent.findUnique({
      where: { id },
    });

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    const data: any = {};
    if (firstName) data.firstName = firstName;
    if (lastName) data.lastName = lastName;
    if (phoneNumber) {
      // Normalize phone number
      let normalized = phoneNumber.trim().replace(/[\s\-\(\)\.]/g, "");
      if (!normalized.startsWith("+")) {
        normalized = `+${normalized}`;
      }
      data.phoneNumber = normalized;
    }
    if (email !== undefined) data.email = email;

    const updatedParent = await prisma.parent.update({
      where: { id },
      data,
    });

    // Remove password from response
    const { password, ...parentWithoutPassword } = updatedParent;

    res.status(200).json({
      success: true,
      parent: parentWithoutPassword,
    });
  } catch (error: any) {
    console.error("Update parent error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const deleteParent = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    const parent = await prisma.parent.findUnique({
      where: { id },
    });

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    await prisma.parent.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Parent deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete parent error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// ==================== PARENT-STUDENT LINKING ====================

export const linkStudentToParent = async (req: any, res: Response) => {
  try {
    const { parentId, studentId, relationship, isPrimary } = req.body;

    if (!parentId || !studentId) {
      return res.status(400).json({
        success: false,
        message: "Parent ID and student ID are required",
      });
    }

    const parent = await prisma.parent.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Check if link already exists
    const existing = await prisma.parentStudent.findUnique({
      where: {
        parentId_studentId: {
          parentId,
          studentId,
        },
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Student is already linked to this parent",
      });
    }

    // If this is set as primary, unset other primary links for this parent
    if (isPrimary) {
      await prisma.parentStudent.updateMany({
        where: {
          parentId,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    const link = await prisma.parentStudent.create({
      data: {
        parentId,
        studentId,
        relationship: relationship || "parent",
        isPrimary: isPrimary || false,
      },
    });

    res.status(201).json({
      success: true,
      link,
    });
  } catch (error: any) {
    console.error("Link student to parent error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const unlinkStudentFromParent = async (req: any, res: Response) => {
  try {
    const { parentId, studentId } = req.params;

    const link = await prisma.parentStudent.findUnique({
      where: {
        parentId_studentId: {
          parentId,
          studentId,
        },
      },
    });

    if (!link) {
      return res.status(404).json({
        success: false,
        message: "Link not found",
      });
    }

    await prisma.parentStudent.delete({
      where: {
        parentId_studentId: {
          parentId,
          studentId,
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Student unlinked from parent successfully",
    });
  } catch (error: any) {
    console.error("Unlink student from parent error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const updateParentStudentLink = async (req: any, res: Response) => {
  try {
    const { parentId, studentId } = req.params;
    const { relationship, isPrimary } = req.body;

    const link = await prisma.parentStudent.findUnique({
      where: {
        parentId_studentId: {
          parentId,
          studentId,
        },
      },
    });

    if (!link) {
      return res.status(404).json({
        success: false,
        message: "Link not found",
      });
    }

    const data: any = {};
    if (relationship) data.relationship = relationship;
    if (isPrimary !== undefined) {
      data.isPrimary = isPrimary;
      // If setting as primary, unset other primary links
      if (isPrimary) {
        await prisma.parentStudent.updateMany({
          where: {
            parentId,
            isPrimary: true,
            NOT: {
              studentId,
            },
          },
          data: {
            isPrimary: false,
          },
        });
      }
    }

    const updatedLink = await prisma.parentStudent.update({
      where: {
        parentId_studentId: {
          parentId,
          studentId,
        },
      },
      data,
    });

    res.status(200).json({
      success: true,
      link: updatedLink,
    });
  } catch (error: any) {
    console.error("Update parent-student link error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};







