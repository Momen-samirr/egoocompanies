/**
 * Migration script to convert existing driver document structure
 * to the new enhanced document verification system
 */

require("dotenv").config();
import prisma from "../utils/prisma";

async function migrateDocumentSchema() {
  try {
    console.log("Starting document schema migration...");

    // Get all drivers
    const drivers = await prisma.driver.findMany({
      select: {
        id: true,
        driversLicensePhoto: true,
        driversLicensePhotos: true,
        documentStatuses: true,
        documentsVerified: true,
        selfiePhoto: true,
        criminalRecordPhoto: true,
        drugTestPhoto: true,
      },
    });

    console.log(`Found ${drivers.length} drivers to migrate`);

    let migrated = 0;
    let skipped = 0;

    for (const driver of drivers) {
      const updates: any = {};

      // Migrate driversLicensePhoto to driversLicensePhotos array
      if (driver.driversLicensePhoto && !driver.driversLicensePhotos) {
        updates.driversLicensePhotos = [
          { side: "front", url: driver.driversLicensePhoto },
        ];
        console.log(
          `Migrating license photo for driver ${driver.id} to array format`
        );
      }

      // Initialize documentStatuses if it doesn't exist
      if (!driver.documentStatuses) {
        const statuses: any = {};

        // Set statuses based on existing documents and verification status
        if (driver.selfiePhoto) {
          statuses.selfie = {
            status: driver.documentsVerified ? "approved" : "pending",
            reviewedAt: driver.documentsVerified
              ? new Date().toISOString()
              : null,
            reviewedBy: driver.documentsVerified ? null : null, // Can't determine who reviewed
            rejectionReason: null,
            rejectedAt: null,
          };
        }

        if (driver.driversLicensePhoto || driver.driversLicensePhotos) {
          const licensePhotos = (driver.driversLicensePhotos as any) || [
            { side: "front", url: driver.driversLicensePhoto },
          ];
          const frontPhoto = Array.isArray(licensePhotos)
            ? licensePhotos.find((p: any) => p.side === "front")
            : null;
          const backPhoto = Array.isArray(licensePhotos)
            ? licensePhotos.find((p: any) => p.side === "back")
            : null;

          if (frontPhoto) {
            statuses.licenseFront = {
              status: driver.documentsVerified ? "approved" : "pending",
              reviewedAt: driver.documentsVerified
                ? new Date().toISOString()
                : null,
              reviewedBy: null,
              rejectionReason: null,
              rejectedAt: null,
            };
          }

          if (backPhoto) {
            statuses.licenseBack = {
              status: driver.documentsVerified ? "approved" : "pending",
              reviewedAt: driver.documentsVerified
                ? new Date().toISOString()
                : null,
              reviewedBy: null,
              rejectionReason: null,
              rejectedAt: null,
            };
          }
        }

        if (driver.criminalRecordPhoto) {
          statuses.criminalRecord = {
            status: driver.documentsVerified ? "approved" : "pending",
            reviewedAt: driver.documentsVerified
              ? new Date().toISOString()
              : null,
            reviewedBy: null,
            rejectionReason: null,
            rejectedAt: null,
          };
        }

        if (driver.drugTestPhoto) {
          statuses.drugTest = {
            status: driver.documentsVerified ? "approved" : "pending",
            reviewedAt: driver.documentsVerified
              ? new Date().toISOString()
              : null,
            reviewedBy: null,
            rejectionReason: null,
            rejectedAt: null,
          };
        }

        if (Object.keys(statuses).length > 0) {
          updates.documentStatuses = statuses;
        }
      }

      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        await prisma.driver.update({
          where: { id: driver.id },
          data: updates,
        });
        migrated++;
      } else {
        skipped++;
      }
    }

    console.log(`Migration complete!`);
    console.log(`- Migrated: ${migrated} drivers`);
    console.log(`- Skipped: ${skipped} drivers (already up to date)`);
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateDocumentSchema()
  .then(() => {
    console.log("Migration script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration script failed:", error);
    process.exit(1);
  });
