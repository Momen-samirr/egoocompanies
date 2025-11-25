import prisma from "../utils/prisma";

interface FinanceResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
}

export async function applyTripCompletionPayout(tripId: string): Promise<FinanceResult> {
  const trip = await prisma.scheduledTrip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      assignedCaptainId: true,
      price: true,
      financialStatus: true,
    },
  });

  if (!trip) {
    return { success: false, reason: "Trip not found" };
  }

  if (!trip.assignedCaptainId) {
    return { success: false, reason: "Trip has no assigned captain" };
  }

  if (trip.financialStatus === "PAID") {
    return { success: true, skipped: true };
  }

  const amount = trip.price ?? 0;

  await prisma.$transaction([
    prisma.driver.update({
      where: { id: trip.assignedCaptainId },
      data: {
        totalEarning: {
          increment: amount,
        },
      },
    }),
    prisma.scheduledTrip.update({
      where: { id: tripId },
      data: {
        financialStatus: "PAID",
      },
    }),
  ]);

  return { success: true };
}

export async function applyTripFailurePenalty(tripId: string): Promise<FinanceResult> {
  const trip = await prisma.scheduledTrip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      assignedCaptainId: true,
      price: true,
      financialStatus: true,
    },
  });

  if (!trip) {
    return { success: false, reason: "Trip not found" };
  }

  if (!trip.assignedCaptainId) {
    return { success: false, reason: "Trip has no assigned captain" };
  }

  if (trip.financialStatus === "PENALIZED") {
    return { success: true, skipped: true };
  }

  const amount = trip.price ?? 0;

  await prisma.$transaction([
    prisma.driver.update({
      where: { id: trip.assignedCaptainId },
      data: {
        totalEarning: {
          decrement: amount,
        },
      },
    }),
    prisma.scheduledTrip.update({
      where: { id: tripId },
      data: {
        financialStatus: "PENALIZED",
      },
    }),
  ]);

  return { success: true };
}

