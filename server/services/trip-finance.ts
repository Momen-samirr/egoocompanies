import { Prisma, ScheduledTripFinancialRule, ScheduledTripStatus } from "@prisma/client";
import prisma from "../utils/prisma";

interface FinanceResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
}

type FinanceRuleConfig = {
  rule: ScheduledTripFinancialRule;
  multiplier: number;
};

const STATUS_FINANCE_RULES: Record<ScheduledTripStatus, FinanceRuleConfig | undefined> = {
  SCHEDULED: undefined,
  ACTIVE: undefined,
  CANCELLED: undefined,
  COMPLETED: { rule: "COMPLETED_FULL", multiplier: 1 },
  FAILED: { rule: "FAILED_DOUBLE", multiplier: -2 },
  EMERGENCY_TERMINATED: { rule: "EMERGENCY_DEDUCTION", multiplier: -1 },
  EMERGENCY_ENDED: { rule: "EMERGENCY_DEDUCTION", multiplier: -1 },
  FORCE_CLOSED: { rule: "FORCE_CLOSED_DEDUCTION", multiplier: 0 }, // Special calculation, multiplier not used
};

const deriveFinancialStatus = (netAmount: number) => {
  if (netAmount > 0) return "PAID";
  if (netAmount < 0) return "PENALIZED";
  return "NONE";
};

async function applyScheduledTripFinance(
  tripId: string,
  overrideStatus?: ScheduledTripStatus
): Promise<FinanceResult> {
  const trip = await prisma.scheduledTrip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      status: true,
      assignedCaptainId: true,
      price: true,
      financialRule: true,
      netAmount: true,
      financialAppliedAt: true,
    },
  });

  if (!trip) {
    return { success: false, reason: "Trip not found" };
  }

  if (!trip.assignedCaptainId) {
    return { success: false, reason: "Trip has no assigned captain" };
  }

  const effectiveStatus = overrideStatus ?? trip.status;
  const ruleConfig = STATUS_FINANCE_RULES[effectiveStatus];

  if (!ruleConfig) {
    return { success: true, skipped: true, reason: "Status not eligible for finance rule" };
  }

  const baseAmount = trip.price ?? 0;
  
  // Special calculations for certain statuses
  let netAmount: number;
  if (effectiveStatus === "FORCE_CLOSED" && ruleConfig.rule === "FORCE_CLOSED_DEDUCTION") {
    // FORCE_CLOSED: deduct 100 from trip price
    netAmount = baseAmount - 100;
  } else if (effectiveStatus === "FAILED" && ruleConfig.rule === "FAILED_DOUBLE") {
    // FAILED (automatic): apply fixed -50 deduction
    netAmount = baseAmount - 50;
  } else {
    netAmount = baseAmount * ruleConfig.multiplier;
  }
  const existingLedger = await prisma.scheduledTripLedger.findFirst({
    where: { scheduledTripId: tripId },
  });

  if (existingLedger && existingLedger.rule === ruleConfig.rule && existingLedger.netAmount === netAmount) {
    return { success: true, skipped: true };
  }

  const netDelta = existingLedger ? netAmount - existingLedger.netAmount : netAmount;
  const financialStatus = deriveFinancialStatus(netAmount);
  const financialAppliedAt = new Date();

  const transactionOps: Prisma.PrismaPromise<unknown>[] = [];

  transactionOps.push(
    prisma.driver.update({
      where: { id: trip.assignedCaptainId },
      data: {
        totalEarning: {
          increment: netDelta,
        },
        scheduledTripBalance: {
          increment: netDelta,
        },
      },
    })
  );

  transactionOps.push(
    prisma.scheduledTrip.update({
      where: { id: tripId },
      data: {
        financialStatus,
        financialRule: ruleConfig.rule,
        financialAdjustment: netAmount,
        netAmount,
        financialAppliedAt,
      },
    })
  );

  if (existingLedger) {
    transactionOps.push(
      prisma.scheduledTripLedger.update({
        where: { id: existingLedger.id },
        data: {
          baseAmount,
          adjustmentAmount: netAmount,
          netAmount,
          rule: ruleConfig.rule,
          statusAtCalculation: effectiveStatus,
          calculatedAt: financialAppliedAt,
        },
      })
    );
  } else {
    transactionOps.push(
      prisma.scheduledTripLedger.create({
        data: {
          scheduledTripId: tripId,
          captainId: trip.assignedCaptainId,
          baseAmount,
          adjustmentAmount: netAmount,
          netAmount,
          rule: ruleConfig.rule,
          statusAtCalculation: effectiveStatus,
          calculatedAt: financialAppliedAt,
        },
      })
    );
  }

  await prisma.$transaction(transactionOps);

  return { success: true };
}

export async function applyTripCompletionPayout(tripId: string): Promise<FinanceResult> {
  return applyScheduledTripFinance(tripId, "COMPLETED");
}

export async function applyTripFailurePenalty(tripId: string): Promise<FinanceResult> {
  return applyScheduledTripFinance(tripId, "FAILED");
}

export async function applyEmergencyTerminationPenalty(tripId: string): Promise<FinanceResult> {
  return applyScheduledTripFinance(tripId, "EMERGENCY_ENDED");
}

export async function applyForceClosedDeduction(tripId: string): Promise<FinanceResult> {
  return applyScheduledTripFinance(tripId, "FORCE_CLOSED");
}

/**
 * Apply financial logic based on trip status
 * This should be called whenever a trip status changes (automatic or manual)
 * @param tripId - The trip ID
 * @param newStatus - The new status to apply finance logic for
 * @param previousStatus - Optional previous status for special cases
 * @returns FinanceResult
 */
export async function applyStatusChangeFinance(
  tripId: string,
  newStatus: ScheduledTripStatus,
  previousStatus?: ScheduledTripStatus
): Promise<FinanceResult> {
  // Special case: Failed → Cancelled uses double price penalty
  if (previousStatus === "FAILED" && newStatus === "CANCELLED") {
    return applyFailedToCancelledPenalty(tripId);
  }
  
  // For all other statuses, use the standard finance logic
  return applyScheduledTripFinance(tripId, newStatus);
}

/**
 * Apply double price penalty when admin manually changes Failed trip to Cancelled
 * This represents the case where captain was absent and didn't follow the schedule
 */
export async function applyFailedToCancelledPenalty(tripId: string): Promise<FinanceResult> {
  const trip = await prisma.scheduledTrip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      status: true,
      assignedCaptainId: true,
      price: true,
      financialRule: true,
      netAmount: true,
      financialAppliedAt: true,
    },
  });

  if (!trip) {
    return { success: false, reason: "Trip not found" };
  }

  if (!trip.assignedCaptainId) {
    return { success: false, reason: "Trip has no assigned captain" };
  }

  // Verify trip is in CANCELLED status
  if (trip.status !== "CANCELLED") {
    return { success: false, reason: "Trip is not in CANCELLED status" };
  }

  const baseAmount = trip.price ?? 0;
  // Double price penalty: -2 × price
  const netAmount = baseAmount * -2;
  const ruleConfig = { rule: "FAILED_DOUBLE" as ScheduledTripFinancialRule };

  const existingLedger = await prisma.scheduledTripLedger.findFirst({
    where: { scheduledTripId: tripId },
  });

  // Check if we already applied a penalty for this trip
  // If there's an existing ledger, calculate the delta needed to reach the new penalty
  // The new penalty is -2 × price, which should be the final netAmount
  let netDelta: number;
  if (existingLedger) {
    // Calculate the difference needed: new final amount - existing final amount
    // Example: if existing netAmount is 50 (from -50 deduction on 100 price trip)
    // and new netAmount should be -200 (-2 × 100), then netDelta = -200 - 50 = -250
    // This means we need to deduct an additional 250 from driver balance
    netDelta = netAmount - existingLedger.netAmount;
  } else {
    // No existing ledger, apply the full penalty
    netDelta = netAmount;
  }

  // If netDelta is 0 or positive, no additional penalty needed
  // (This could happen if penalty was already applied or somehow the existing penalty is worse)
  if (netDelta >= 0) {
    return { success: true, skipped: true, reason: "Penalty already applied or no additional penalty needed" };
  }

  const financialStatus = deriveFinancialStatus(netAmount);
  const financialAppliedAt = new Date();

  const transactionOps: Prisma.PrismaPromise<unknown>[] = [];

  transactionOps.push(
    prisma.driver.update({
      where: { id: trip.assignedCaptainId },
      data: {
        totalEarning: {
          increment: netDelta,
        },
        scheduledTripBalance: {
          increment: netDelta,
        },
      },
    })
  );

  transactionOps.push(
    prisma.scheduledTrip.update({
      where: { id: tripId },
      data: {
        financialStatus,
        financialRule: ruleConfig.rule,
        financialAdjustment: netAmount,
        netAmount,
        financialAppliedAt,
      },
    })
  );

  if (existingLedger) {
    transactionOps.push(
      prisma.scheduledTripLedger.update({
        where: { id: existingLedger.id },
        data: {
          baseAmount,
          adjustmentAmount: netAmount,
          netAmount,
          rule: ruleConfig.rule,
          statusAtCalculation: "CANCELLED" as ScheduledTripStatus,
          calculatedAt: financialAppliedAt,
        },
      })
    );
  } else {
    transactionOps.push(
      prisma.scheduledTripLedger.create({
        data: {
          scheduledTripId: tripId,
          captainId: trip.assignedCaptainId,
          baseAmount,
          adjustmentAmount: netAmount,
          netAmount,
          rule: ruleConfig.rule,
          statusAtCalculation: "CANCELLED" as ScheduledTripStatus,
          calculatedAt: financialAppliedAt,
        },
      })
    );
  }

  await prisma.$transaction(transactionOps);

  return { success: true };
}

