import {
  ScheduledTrip,
  ScheduledTripFinancialRule,
  ScheduledTripStatus,
} from "@/types/trip";

const RULE_MULTIPLIERS: Record<ScheduledTripFinancialRule, number> = {
  NONE: 0,
  COMPLETED_FULL: 1,
  FAILED_DOUBLE: -2,
  EMERGENCY_DEDUCTION: -1,
  FORCE_CLOSED_DEDUCTION: 0, // Special calculation, multiplier not used
};

const STATUS_RULE_MAP: Partial<Record<ScheduledTripStatus, ScheduledTripFinancialRule>> = {
  COMPLETED: "COMPLETED_FULL",
  FAILED: "FAILED_DOUBLE",
  EMERGENCY_ENDED: "EMERGENCY_DEDUCTION",
  EMERGENCY_TERMINATED: "EMERGENCY_DEDUCTION",
  FORCE_CLOSED: "FORCE_CLOSED_DEDUCTION",
};

const RULE_LABELS: Record<ScheduledTripFinancialRule, string> = {
  NONE: "No Adjustment",
  COMPLETED_FULL: "Full Payout",
  FAILED_DOUBLE: "Double Price Deduction",
  EMERGENCY_DEDUCTION: "Emergency Deduction",
  FORCE_CLOSED_DEDUCTION: "Force Closed",
};

export const formatCurrency = (value: number, currency = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
};

export const deriveTripFinance = (trip: ScheduledTrip) => {
  const baseAmount = trip.price ?? 0;

  let resolvedRule: ScheduledTripFinancialRule = trip.financialRule || "NONE";
  if (resolvedRule === "NONE") {
    const fallbackRule = STATUS_RULE_MAP[trip.status];
    if (fallbackRule) {
      resolvedRule = fallbackRule;
    }
  }

  // Special calculation for FORCE_CLOSED: deduct 100 from trip price
  let computedNet: number;
  if (resolvedRule === "FORCE_CLOSED_DEDUCTION" || trip.status === "FORCE_CLOSED") {
    computedNet = baseAmount - 100;
  } else {
    const multiplier = RULE_MULTIPLIERS[resolvedRule] ?? 0;
    computedNet = baseAmount * multiplier;
  }

  // Ensure we always have valid numbers, never null/undefined/NaN
  const netAmount =
    typeof trip.netAmount === "number" && !isNaN(trip.netAmount)
      ? trip.netAmount
      : (isNaN(computedNet) ? 0 : computedNet);
  
  const appliedAmount =
    typeof trip.financialAdjustment === "number" && !isNaN(trip.financialAdjustment)
      ? trip.financialAdjustment
      : (isNaN(netAmount) ? 0 : netAmount);

  return {
    baseAmount: isNaN(baseAmount) ? 0 : baseAmount,
    appliedAmount: isNaN(appliedAmount) ? 0 : appliedAmount,
    netAmount: isNaN(netAmount) ? 0 : netAmount,
    rule: resolvedRule,
    ruleLabel: RULE_LABELS[resolvedRule],
    hasFinanceApplied: Boolean(trip.financialAppliedAt),
  };
};

