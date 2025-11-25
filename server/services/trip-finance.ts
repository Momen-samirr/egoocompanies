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
  
  // Special calculation for FORCE_CLOSED: deduct (tripPrice - 100)
  let netAmount: number;
  if (effectiveStatus === "FORCE_CLOSED" && ruleConfig.rule === "FORCE_CLOSED_DEDUCTION") {
    netAmount = -(baseAmount - 100);
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

