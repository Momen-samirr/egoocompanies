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
    console.log("🔍 [getAdminNotifications] ===== START =====");
    console.log("🔍 [getAdminNotifications] Input params:", {
      adminId,
      filters: JSON.stringify(filters, null, 2),
    });

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

    // First, check total count in database and get a sample
    console.log(
      "🔍 [getAdminNotifications] Step 1: Checking total count in DB..."
    );
    const totalInDb = await prisma.adminNotification.count({});
    console.log(
      "🔍 [getAdminNotifications] Total notifications in DB (no filters):",
      totalInDb
    );

    // Get a sample notification to see what exists
    if (totalInDb > 0) {
      const sampleNotification = await prisma.adminNotification.findFirst({
        select: {
          id: true,
          adminId: true,
          driverId: true,
          type: true,
          documentType: true,
          status: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
      console.log(
        "🔍 [getAdminNotifications] Sample notification (latest):",
        JSON.stringify(sampleNotification, null, 2)
      );
    } else {
      console.log(
        "⚠️ [getAdminNotifications] No notifications found in database!"
      );
    }

    // Build where clause - only use base filters, ignore adminId
    console.log("🔍 [getAdminNotifications] Step 2: Building where clause...");
    const where: any = {};

    if (driverId) {
      where.driverId = driverId;
      console.log(
        "🔍 [getAdminNotifications] Added driverId filter:",
        driverId
      );
    }

    if (documentType) {
      where.documentType = documentType;
      console.log(
        "🔍 [getAdminNotifications] Added documentType filter:",
        documentType
      );
    }

    if (status) {
      where.status = status;
      console.log("🔍 [getAdminNotifications] Added status filter:", status);
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
        console.log(
          "🔍 [getAdminNotifications] Added startDate filter:",
          startDate
        );
      }
      if (endDate) {
        where.createdAt.lte = endDate;
        console.log(
          "🔍 [getAdminNotifications] Added endDate filter:",
          endDate
        );
      }
    }

    // Use undefined for empty where clause (Prisma handles this better than {})
    const actualWhere = Object.keys(where).length === 0 ? undefined : where;

    console.log(
      "🔍 [getAdminNotifications] Final where clause:",
      actualWhere
        ? JSON.stringify(actualWhere, null, 2)
        : "undefined (no filters)"
    );
    console.log("🔍 [getAdminNotifications] Pagination params:", {
      page,
      limit,
      skip,
    });
    console.log("🔍 [getAdminNotifications] All filter values:", {
      driverId,
      documentType,
      status,
      startDate: startDate ? startDate.toISOString() : null,
      endDate: endDate ? endDate.toISOString() : null,
    });

    // Execute query with driver relation
    let notifications, total;

    try {
      console.log(
        "🔍 [getAdminNotifications] Step 3: Executing test query (no filters)..."
      );

      // TEST: First, try querying WITHOUT any filters to see if we get results
      const testQuery = await prisma.adminNotification.findMany({
        take: 5,
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
      });
      console.log(
        "🔍 [getAdminNotifications] TEST - Query without filters found:",
        testQuery.length,
        "notifications"
      );
      if (testQuery.length > 0) {
        console.log(
          "🔍 [getAdminNotifications] TEST - First notification sample:",
          JSON.stringify(
            {
              id: testQuery[0].id,
              driverId: testQuery[0].driverId,
              driver: testQuery[0].driver,
              type: testQuery[0].type,
              documentType: testQuery[0].documentType,
              status: testQuery[0].status,
              createdAt: testQuery[0].createdAt,
            },
            null,
            2
          )
        );
      } else {
        console.log(
          "⚠️ [getAdminNotifications] TEST - No notifications found even without filters!"
        );
      }

      // Now execute the actual query with filters
      console.log(
        "🔍 [getAdminNotifications] Step 4: Executing actual query with filters..."
      );
      console.log("🔍 [getAdminNotifications] Query params:", {
        where: actualWhere,
        skip,
        take: limit,
      });

      const [notificationsResult, totalResult] = await Promise.all([
        prisma.adminNotification.findMany({
          where: actualWhere,
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
        prisma.adminNotification.count({ where: actualWhere }),
      ]);

      notifications = notificationsResult;
      total = totalResult;

      console.log("🔍 [getAdminNotifications] Query execution completed:", {
        notificationsFound: notifications.length,
        total,
        page,
        limit,
        skip,
      });

      if (notifications.length > 0) {
        console.log(
          "🔍 [getAdminNotifications] First notification from results:",
          JSON.stringify(
            {
              id: notifications[0].id,
              driverId: notifications[0].driverId,
              driver: notifications[0].driver,
              type: notifications[0].type,
              documentType: notifications[0].documentType,
              status: notifications[0].status,
              createdAt: notifications[0].createdAt,
            },
            null,
            2
          )
        );
      }

      // If test query found notifications but actual query didn't, there's a filter issue
      if (testQuery.length > 0 && notifications.length === 0) {
        console.log(
          "⚠️ [getAdminNotifications] WARNING: Test query found notifications but filtered query returned 0!"
        );
        console.log(
          "⚠️ [getAdminNotifications] This suggests the where clause is filtering out all results."
        );
        console.log(
          "⚠️ [getAdminNotifications] Test query count:",
          testQuery.length,
          "| Filtered query count:",
          notifications.length
        );
        console.log(
          "⚠️ [getAdminNotifications] Applied where clause:",
          JSON.stringify(actualWhere, null, 2)
        );
      } else if (testQuery.length === 0 && notifications.length === 0) {
        console.log(
          "ℹ️ [getAdminNotifications] Both test and filtered queries returned 0 - database appears empty or all records filtered out."
        );
      }
    } catch (relationError: any) {
      console.error(
        "⚠️ [getAdminNotifications] Driver relation error occurred:",
        relationError.message
      );
      console.error(
        "⚠️ [getAdminNotifications] Error stack:",
        relationError.stack
      );
      console.log(
        "🔍 [getAdminNotifications] Step 4 (Fallback): Fetching without driver relation..."
      );

      // If driver relation fails (e.g., driver was deleted), fetch without relation
      const notificationsWithoutRelation =
        await prisma.adminNotification.findMany({
          where: actualWhere,
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: limit,
        });

      console.log(
        "🔍 [getAdminNotifications] Found",
        notificationsWithoutRelation.length,
        "notifications without relation. Fetching driver data manually..."
      );

      // Manually fetch driver data for each notification
      notifications = await Promise.all(
        notificationsWithoutRelation.map(async (notification, index) => {
          try {
            const driver = await prisma.driver.findUnique({
              where: { id: notification.driverId },
              select: {
                id: true,
                name: true,
                email: true,
              },
            });
            if (!driver) {
              console.log(
                `⚠️ [getAdminNotifications] Driver not found for notification ${notification.id} (driverId: ${notification.driverId})`
              );
            }
            return {
              ...notification,
              driver: driver || null,
            };
          } catch (driverError: any) {
            // If driver doesn't exist, set driver to null
            console.log(
              `⚠️ [getAdminNotifications] Error fetching driver for notification ${notification.id}:`,
              driverError.message
            );
            return {
              ...notification,
              driver: null,
            };
          }
        })
      );

      total = await prisma.adminNotification.count({ where: actualWhere });

      console.log("🔍 [getAdminNotifications] Fallback query results:", {
        notificationsFound: notifications.length,
        total,
        notificationsWithDriver: notifications.filter((n) => n.driver !== null)
          .length,
        notificationsWithoutDriver: notifications.filter(
          (n) => n.driver === null
        ).length,
      });
    }

    const totalPages = Math.ceil(total / limit);

    console.log("🔍 [getAdminNotifications] Step 5: Final result summary:", {
      notificationsCount: notifications.length,
      total,
      page,
      limit,
      skip,
      totalPages,
      hasNotifications: notifications.length > 0,
      notificationIds: notifications.slice(0, 5).map((n) => n.id),
    });

    console.log("🔍 [getAdminNotifications] ===== END =====");

    return {
      notifications,
      total,
      page,
      limit,
      totalPages,
    };
  } catch (error: any) {
    console.error(
      "❌ [getAdminNotifications] Error fetching admin notifications:",
      error
    );
    console.error("❌ [getAdminNotifications] Error message:", error.message);
    console.error("❌ [getAdminNotifications] Error stack:", error.stack);
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
        status: NotificationStatus.UNREAD,
      },
    });

    return count;
  } catch (error: any) {
    console.error("Error getting unread count:", error);
    return 0;
  }
}
