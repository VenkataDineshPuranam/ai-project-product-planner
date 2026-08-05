import type { InferenceCostProfile, TokenBudget } from "@/domain";

export function computeInferenceCost(profile: InferenceCostProfile, inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * profile.costPerMillionInputTokens + (outputTokens / 1_000_000) * profile.costPerMillionOutputTokens;
}

/** True once consumedTokens/limitTokens reaches or exceeds thresholdRatio (e.g. 0.8 = 80%). */
export function tokenBudgetAlert(budget: TokenBudget, thresholdRatio: number): boolean {
  if (budget.limitTokens <= 0) return false;
  return budget.consumedTokens / budget.limitTokens >= thresholdRatio;
}

/** Undefined (never 0 or Infinity) when there are no accepted outcomes to divide by. */
export function costPerAcceptedOutcome(totalCost: number, acceptedOutcomeCount: number): number | undefined {
  if (acceptedOutcomeCount <= 0) return undefined;
  return totalCost / acceptedOutcomeCount;
}

export interface CostQualityPoint {
  cost: number;
  quality: number;
}

export interface CostChangeEvaluation {
  costImproved: boolean;
  qualityRegressed: boolean;
  /** Cost reduction only counts as a genuine improvement if quality did not regress. */
  isGenuineImprovement: boolean;
}

export function evaluateCostChange(before: CostQualityPoint, after: CostQualityPoint): CostChangeEvaluation {
  const costImproved = after.cost < before.cost;
  const qualityRegressed = after.quality < before.quality;
  return { costImproved, qualityRegressed, isGenuineImprovement: costImproved && !qualityRegressed };
}
