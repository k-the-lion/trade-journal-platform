import type { PropPlannerInputs } from "./types";

export const DEFAULT_PROP_PLANNER_INPUTS: PropPlannerInputs = {
  avgProfit: 100,
  avgLoss: 100,
  tradingDaysPerMonth: 21,
  winRate: 65,
  directToFunded: false,
  profitSplit: 90,
  consistencyEnabled: false,
  consistencyPct: 20,
  accountCount: 5,
  scalingPlanPct: 100,
  accountFeeRecurring: false,
  accountFeeAmount: 0,
  activationEnabled: false,
  activationFeeAmount: 0,
  evalProfitTarget: 3000,
  bufferAmount: 2000,
  firstPayout: 500,
  recurringPayout: 1000,
  maxDrawdown: 2000,
};

export const PROP_PLANNER_STORAGE_KEY = "tradeJournalPropPlannerInputs";
