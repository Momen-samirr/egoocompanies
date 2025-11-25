require("dotenv").config();
import prisma from "../utils/prisma";

async function main() {
  console.log("🧹 Starting scheduled trips cleanup...\n");

  // Step 1: Delete all ScheduledTripLedger entries (no cascade)
  console.log("📊 Deleting ScheduledTripLedger entries...");
  const ledgerCount = await prisma.scheduledTripLedger.count();
  const ledgerResult = await prisma.scheduledTripLedger.deleteMany({});
  console.log(`   ✓ Deleted ${ledgerResult.count} of ${ledgerCount} ledger entries\n`);

  // Step 2: Delete all EmergencyUsage entries (references tripId, no cascade)
  console.log("🚨 Deleting EmergencyUsage entries...");
  const emergencyCount = await prisma.emergencyUsage.count();
  const emergencyResult = await prisma.emergencyUsage.deleteMany({});
  console.log(`   ✓ Deleted ${emergencyResult.count} of ${emergencyCount} emergency usage records\n`);

  // Step 3: Delete all ScheduledTrip entries (will cascade delete TripPoint, TripProgress, TripActivationCheck)
  console.log("🚗 Deleting ScheduledTrip entries...");
  const tripCount = await prisma.scheduledTrip.count();
  const tripResult = await prisma.scheduledTrip.deleteMany({});
  console.log(`   ✓ Deleted ${tripResult.count} of ${tripCount} scheduled trips\n`);

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
    console.log("\n✅ Cleanup completed successfully! All scheduled trip data has been removed.");
  } else {
    console.log("\n⚠️  Warning: Some data remains. Please check the counts above.");
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
  .catch((e) => {
    console.error("❌ Error during cleanup:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

