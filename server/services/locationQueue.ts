import Bull from "bull";
import { updateCaptainLocation } from "../controllers/driver.controller";

// Redis URL for Bull queue
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || null;

// Parse Redis URL
const parseRedisUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || "6379"),
      password: parsed.password || REDIS_PASSWORD || undefined,
    };
  } catch {
    // Fallback for simple format
    const parts = url.replace("redis://", "").split(":");
    return {
      host: parts[0] || "localhost",
      port: parseInt(parts[1] || "6379"),
      password: REDIS_PASSWORD || undefined,
    };
  }
};

// Create location update queue
const locationQueue = new Bull("location-updates", {
  redis: parseRedisUrl(REDIS_URL),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000, // Keep max 1000 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  },
});

// Process location updates
locationQueue.process(async (job) => {
  const { driverId, latitude, longitude, heading, accuracy, speed } = job.data;

  try {
    // Create a mock request object for the controller
    const mockReq = {
      driver: { id: driverId },
      body: {
        latitude,
        longitude,
        heading,
        accuracy,
        speed,
      },
    } as any;

    const mockRes = {
      status: (code: number) => ({
        json: (data: any) => {
          if (code >= 400) {
            throw new Error(data.message || "Location update failed");
          }
          return data;
        },
      }),
      json: (data: any) => data,
    } as any;

    await updateCaptainLocation(mockReq, mockRes);
    console.log(`✅ Processed location update job for driver ${driverId}`);
  } catch (error: any) {
    console.error(`❌ Error processing location update job:`, error);
    throw error; // Re-throw to trigger retry
  }
});

// Queue event handlers
locationQueue.on("completed", (job) => {
  console.log(`✅ Location update job ${job.id} completed`);
});

locationQueue.on("failed", (job, err) => {
  console.error(`❌ Location update job ${job?.id} failed:`, err.message);
});

locationQueue.on("error", (error) => {
  console.error(`❌ Location queue error:`, error);
});

/**
 * Add location update to queue
 */
export const queueLocationUpdate = async (data: {
  driverId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  accuracy?: number;
  speed?: number;
}) => {
  try {
    const job = await locationQueue.add(data, {
      priority: 1, // Normal priority
      jobId: `${data.driverId}-${Date.now()}`, // Unique job ID
    });
    return job;
  } catch (error) {
    console.error("Error queueing location update:", error);
    throw error;
  }
};

/**
 * Get queue stats
 */
export const getQueueStats = async () => {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      locationQueue.getWaitingCount(),
      locationQueue.getActiveCount(),
      locationQueue.getCompletedCount(),
      locationQueue.getFailedCount(),
      locationQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  } catch (error) {
    console.error("Error getting queue stats:", error);
    return null;
  }
};

/**
 * Clean up old jobs
 */
export const cleanQueue = async () => {
  try {
    await locationQueue.clean(3600000, "completed", 1000); // Clean completed jobs older than 1 hour
    await locationQueue.clean(86400000, "failed", 100); // Clean failed jobs older than 24 hours
    console.log("✅ Queue cleaned");
  } catch (error) {
    console.error("Error cleaning queue:", error);
  }
};

export { locationQueue };
