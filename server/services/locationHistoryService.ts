import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface LocationHistoryEntry {
  driverId: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
  accuracy?: number | null;
  speed?: number | null;
  timestamp?: Date;
}

class LocationHistoryService {
  private queue: LocationHistoryEntry[] = [];
  private batchSize = 10;
  private batchTimeout = 30000; // 30 seconds
  private flushTimer: NodeJS.Timeout | null = null;

  /**
   * Queue location history entry for batch insertion
   */
  queueLocation(entry: LocationHistoryEntry): void {
    this.queue.push({
      ...entry,
      timestamp: entry.timestamp || new Date(),
    });

    // Flush if queue reaches batch size
    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else {
      // Set timeout to flush queue
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
      }
      this.flushTimer = setTimeout(() => {
        this.flush();
      }, this.batchTimeout);
    }
  }

  /**
   * Flush queued locations to database
   */
  async flush(): Promise<number> {
    if (this.queue.length === 0) {
      return 0;
    }

    const batch = [...this.queue];
    this.queue = [];

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    try {
      // Batch insert locations
      const operations = batch.map((entry) =>
        prisma.driverLocationHistory.create({
          data: {
            driverId: entry.driverId,
            latitude: entry.latitude,
            longitude: entry.longitude,
            heading: entry.heading ?? null,
            accuracy: entry.accuracy ?? null,
            speed: entry.speed ?? null,
            timestamp: entry.timestamp || new Date(),
          },
        })
      );

      await Promise.all(operations);
      console.log(`✅ Inserted ${batch.length} location history entries`);
      return batch.length;
    } catch (error) {
      console.error("❌ Error flushing location history:", error);
      // Re-queue failed entries (limit to prevent memory issues)
      if (this.queue.length < 100) {
        this.queue.unshift(...batch);
      }
      return 0;
    }
  }

  /**
   * Get location history for a driver
   */
  async getDriverHistory(
    driverId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ) {
    try {
      const where: any = { driverId };
      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) {
          where.timestamp.gte = startDate;
        }
        if (endDate) {
          where.timestamp.lte = endDate;
        }
      }

      return await prisma.driverLocationHistory.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: limit,
      });
    } catch (error) {
      console.error("Error getting driver location history:", error);
      return [];
    }
  }

  /**
   * Cleanup old location history (older than specified days)
   */
  async cleanupOldHistory(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await prisma.driverLocationHistory.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      console.log(`✅ Cleaned up ${result.count} old location history entries`);
      return result.count;
    } catch (error) {
      console.error("Error cleaning up location history:", error);
      return 0;
    }
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Force flush (useful for shutdown)
   */
  async forceFlush(): Promise<void> {
    await this.flush();
  }
}

// Export singleton instance
export const locationHistoryService = new LocationHistoryService();

// Flush on process exit
process.on("SIGTERM", async () => {
  await locationHistoryService.forceFlush();
  await prisma.$disconnect();
});

process.on("SIGINT", async () => {
  await locationHistoryService.forceFlush();
  await prisma.$disconnect();
});
