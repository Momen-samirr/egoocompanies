require("dotenv").config();
import prisma from "../utils/prisma";

// Helper function to test database connection with retry logic
async function testConnection(
  maxRetries = 3,
  delayMs = 2000
): Promise<boolean> {
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error("❌ Error: DATABASE_URL environment variable is not set!");
    console.error(
      "   Please ensure your .env file contains a valid DATABASE_URL."
    );
    return false;
  }

  // Mask the connection string for security (show only first part)
  const dbUrl = process.env.DATABASE_URL;
  const maskedUrl = dbUrl.includes("@") ? dbUrl.split("@")[0] + "@***" : "***";
  console.log(`🔌 Testing database connection (${maskedUrl})...`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Try to establish connection
      await prisma.$connect();
      console.log("   ✓ Database connection successful!\n");
      return true;
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries;
      const errorMsg = error.message || String(error);

      if (isLastAttempt) {
        console.error(`   ✗ Connection failed after ${maxRetries} attempts`);
        console.error(`\n❌ Database Connection Error:`);
        console.error(`   ${errorMsg}`);

        if (
          errorMsg.includes("DNS resolution") ||
          errorMsg.includes("timed out")
        ) {
          console.error(`\n💡 Troubleshooting tips:`);
          console.error(`   1. Check your internet connection`);
          console.error(
            `   2. Verify the DATABASE_URL in your .env file is correct`
          );
          console.error(`   3. Ensure the MongoDB server is accessible`);
          console.error(
            `   4. Check firewall settings if using a remote database`
          );
          console.error(
            `   5. If using MongoDB Atlas, verify your IP is whitelisted`
          );
        }
        return false;
      } else {
        console.log(
          `   ⚠️  Connection attempt ${attempt}/${maxRetries} failed, retrying in ${delayMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  return false;
}

// Helper function to retry operations with exponential backoff
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 5,
  baseDelayMs = 1000,
  operationName = "operation"
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries;
      const isRetryableError =
        error.message?.includes("write conflict") ||
        error.message?.includes("deadlock") ||
        error.message?.includes("Transaction failed");

      if (!isRetryableError || isLastAttempt) {
        throw error;
      }

      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(
        `   ⚠️  ${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("Max retries exceeded");
}

async function main() {
  console.log("🧹 Starting scheduled trips cleanup...\n");

  // Test connection before proceeding
  const connected = await testConnection();
  if (!connected) {
    console.error(
      "\n❌ Cannot proceed without database connection. Exiting..."
    );
    process.exit(1);
  }

  // Step 1: Delete all ScheduledTripLedger entries (no cascade)
  console.log("📊 Deleting ScheduledTripLedger entries...");
  const ledgerCount = await prisma.scheduledTripLedger.count();
  const ledgerResult = await retryOperation(
    () => prisma.scheduledTripLedger.deleteMany({}),
    5,
    1000,
    "ScheduledTripLedger deletion"
  );
  console.log(
    `   ✓ Deleted ${ledgerResult.count} of ${ledgerCount} ledger entries\n`
  );

  // Step 2: Delete all EmergencyUsage entries (references tripId, no cascade)
  console.log("🚨 Deleting EmergencyUsage entries...");
  const emergencyCount = await prisma.emergencyUsage.count();
  const emergencyResult = await retryOperation(
    () => prisma.emergencyUsage.deleteMany({}),
    5,
    1000,
    "EmergencyUsage deletion"
  );
  console.log(
    `   ✓ Deleted ${emergencyResult.count} of ${emergencyCount} emergency usage records\n`
  );

  // Step 3: Delete all ScheduledTrip entries (will cascade delete TripPoint, TripProgress, TripActivationCheck)
  console.log("🚗 Deleting ScheduledTrip entries...");
  const tripCount = await prisma.scheduledTrip.count();
  
  // Add a small delay before the large deletion to avoid conflicts
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  const tripResult = await retryOperation(
    () => prisma.scheduledTrip.deleteMany({}),
    5,
    2000,
    "ScheduledTrip deletion"
  );
  console.log(
    `   ✓ Deleted ${tripResult.count} of ${tripCount} scheduled trips\n`
  );

  // Step 4: Verify cascading deletes worked
  console.log("🔍 Verifying cleanup...");
  const remainingPoints = await prisma.tripPoint.count();
  const remainingProgress = await prisma.tripProgress.count();
  const remainingChecks = await prisma.tripActivationCheck.count();
  const remainingTrips = await prisma.scheduledTrip.count();
  const remainingLedger = await prisma.scheduledTripLedger.count();
  const remainingEmergency = await prisma.emergencyUsage.count();

  console.log("\n📋 Cleanup Summary:");
  console.log(`   ScheduledTrips: ${remainingTrips} remaining`);
  console.log(`   TripPoints: ${remainingPoints} remaining`);
  console.log(`   TripProgress: ${remainingProgress} remaining`);
  console.log(`   TripActivationChecks: ${remainingChecks} remaining`);
  console.log(`   ScheduledTripLedger: ${remainingLedger} remaining`);
  console.log(`   EmergencyUsage: ${remainingEmergency} remaining`);

  if (
    remainingTrips === 0 &&
    remainingPoints === 0 &&
    remainingProgress === 0 &&
    remainingChecks === 0 &&
    remainingLedger === 0 &&
    remainingEmergency === 0
  ) {
    console.log(
      "\n✅ Cleanup completed successfully! All scheduled trip data has been removed."
    );
  } else {
    console.log(
      "\n⚠️  Warning: Some data remains. Please check the counts above."
    );
  }

  // Note: Driver scheduledTripBalance is NOT reset automatically
  // If you want to reset driver balances, you can uncomment the following:
  /*
  console.log("\n💰 Resetting driver scheduledTripBalance...");
  const driverResult = await prisma.driver.updateMany({
    data: {
      scheduledTripBalance: 0,
    },
  });
  console.log(`   ✓ Reset balance for ${driverResult.count} drivers`);
  */
}

main()
  .catch((e: any) => {
    console.error("\n❌ Error during cleanup:");

    // Provide more specific error messages
    if (e.code === "ENOTFOUND" || e.message?.includes("DNS resolution")) {
      console.error("   Database hostname could not be resolved.");
      console.error(
        "   Please check your DATABASE_URL and network connectivity."
      );
    } else if (e.message?.includes("timed out")) {
      console.error("   Connection timed out.");
      console.error(
        "   The database server may be unreachable or your connection is slow."
      );
    } else if (e.message?.includes("authentication")) {
      console.error("   Authentication failed.");
      console.error(
        "   Please verify your database credentials in DATABASE_URL."
      );
    } else {
      console.error(`   ${e.message || String(e)}`);
    }

    if (process.env.DEBUG) {
      console.error("\nFull error details:");
      console.error(e);
    }

    process.exit(1);
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
  });
