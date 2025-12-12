import prisma from "../utils/prisma";
import { NotificationType, NotificationStatus } from "@prisma/client";

export interface NotificationFilters {
  adminId?: string;
  driverId?: string;
  documentType?: string;
  status?: NotificationStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface NotificationResponse {
  notifications: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Create a notification for document upload/update
 */
export async function createDocumentNotification(
  driverId: string,
  documentType: string,
  isUpdate: boolean = false
) {
  try {
    const notification = await prisma.adminNotification.create({
      data: {
        driverId,
        type: isUpdate
          ? NotificationType.DOCUMENT_UPDATE
          : NotificationType.DOCUMENT_UPLOAD,
        documentType,
        status: NotificationStatus.UNREAD,
        // adminId is null to notify all admins
      },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      success: true,
      notification,
    };
  } catch (error: any) {
    console.error("Error creating document notification:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get notifications for an admin with filters and pagination
 */
export async function getAdminNotifications(
  adminId: string | null,
  filters: NotificationFilters = {}
): Promise<NotificationResponse> {
  try {
    const {
      driverId,
      documentType,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = filters;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      // If adminId is provided, get notifications for that admin or all admins (null)
      // If adminId is null, get all notifications
      OR: adminId ? [{ adminId: null }, { adminId }] : [{ adminId: null }],
    };

    if (driverId) {
      where.driverId = driverId;
    }

    if (documentType) {
      where.documentType = documentType;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    // Get notifications and total count
    const [notifications, total] = await Promise.all([
      prisma.adminNotification.findMany({
        where,
        include: {
          driver: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.adminNotification.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      notifications,
      total,
      page,
      limit,
      totalPages,
    };
  } catch (error: any) {
    console.error("Error fetching admin notifications:", error);
    throw error;
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
  adminId: string
) {
  try {
    const notification = await prisma.adminNotification.update({
      where: {
        id: notificationId,
      },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
        readBy: adminId,
      },
    });

    return {
      success: true,
      notification,
    };
  } catch (error: any) {
    console.error("Error marking notification as read:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Mark all notifications as read for an admin
 */
export async function markAllAsRead(adminId: string) {
  try {
    const result = await prisma.adminNotification.updateMany({
      where: {
        OR: [{ adminId: null }, { adminId }],
        status: NotificationStatus.UNREAD,
      },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
        readBy: adminId,
      },
    });

    return {
      success: true,
      count: result.count,
    };
  } catch (error: any) {
    console.error("Error marking all notifications as read:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get unread notification count for an admin
 */
export async function getUnreadCount(adminId: string | null): Promise<number> {
  try {
    const count = await prisma.adminNotification.count({
      where: {
        OR: adminId ? [{ adminId: null }, { adminId }] : [{ adminId: null }],
        status: NotificationStatus.UNREAD,
      },
    });

    return count;
  } catch (error: any) {
    console.error("Error getting unread count:", error);
    return 0;
  }
}
