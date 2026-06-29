import {
  clampConsistencyPct,
  clampScalingPlanPct,
  clampTradingDaysPerMonth,
  formatPlannerCurrency,
  formatTradingDuration,
} from "./format";
import type { PropPlannerInputs, PropPlannerResults } from "./types";

export function calculatePropPlanner(raw: PropPlannerInputs): PropPlannerResults {
  const tradingDaysPerMonth = clampTradingDaysPerMonth(raw.tradingDaysPerMonth);
  const tradingDaysPerYear = tradingDaysPerMonth * 12;

  const profit = raw.avgProfit || 0;
  const loss = raw.avgLoss || 0;
  const accounts = raw.accountCount || 0;
  const winRate = raw.winRate || 0;
  const directToFunded = raw.directToFunded;
  const scalingPlanPct = clampScalingPlanPct(raw.scalingPlanPct);
  const fundedScale = directToFunded ? 1 : scalingPlanPct / 100;
  const split = raw.profitSplit || 0;

  const buffer = raw.bufferAmount || 0;
  const firstPayout = raw.firstPayout || 0;
  const recurringPayout = raw.recurringPayout || 0;
  const maxDrawdown = raw.maxDrawdown || 0;

  const consistencyEnabled = raw.consistencyEnabled;
  const consistencyPct = clampConsistencyPct(raw.consistencyPct);

  const accountFeeRecurring = directToFunded ? false : raw.accountFeeRecurring;
  const accountFeeRaw = raw.accountFeeAmount || 0;
  const monthlyAcctFee = accountFeeRecurring ? accountFeeRaw : 0;
  const oneTimeAcctFeePerAcc = !accountFeeRecurring ? accountFeeRaw : 0;

  const activationEnabled = directToFunded ? false : raw.activationEnabled;
  const activationFeeAmount = raw.activationFeeAmount || 0;
  const evalProfitTarget = raw.evalProfitTarget || 0;

  const lossRate = 100 - winRate;
  const profitFunded = profit * fundedScale;
  const lossFunded = loss * fundedScale;
  const evPerAccount = profit * (winRate / 100) - loss * (lossRate / 100);
  const evPerAccountFunded =
    profitFunded * (winRate / 100) - lossFunded * (lossRate / 100);

  const netDailyPerAccountEval =
    evPerAccount > 0 ? evPerAccount * (split / 100) : evPerAccount;
  const netDailyPerAccountFunded =
    evPerAccountFunded > 0
      ? evPerAccountFunded * (split / 100)
      : evPerAccountFunded;

  const tradingMonthlyTotalEval =
    netDailyPerAccountEval * tradingDaysPerMonth * accounts;
  const tradingDailyTotal = netDailyPerAccountFunded * accounts;
  const tradingMonthlyTotal = tradingDailyTotal * tradingDaysPerMonth;
  const tradingAnnualTotal =
    netDailyPerAccountFunded * tradingDaysPerYear * accounts;

  const recurringCostMonthly = accounts * monthlyAcctFee;

  let evalDaysPass: number | null = null;
  let evalSubBillPeriods = 0;
  let evalSubCostDuringEval = 0;
  if (!directToFunded && evalProfitTarget > 0 && evPerAccount > 0) {
    evalDaysPass = Math.ceil(evalProfitTarget / evPerAccount);
    evalSubBillPeriods = Math.ceil(evalDaysPass / tradingDaysPerMonth);
    if (accountFeeRecurring && monthlyAcctFee > 0 && accounts > 0) {
      evalSubCostDuringEval = evalSubBillPeriods * monthlyAcctFee * accounts;
    }
  }

  const feeCompareMonthly = directToFunded
    ? tradingMonthlyTotal
    : tradingMonthlyTotalEval;
  const afterRecurringMonthly = feeCompareMonthly - recurringCostMonthly;

  const activationPerAccount = activationEnabled ? activationFeeAmount : 0;
  const oneTimeEvalPerAccount = oneTimeAcctFeePerAcc;
  const oneTimeEvalTotal = accounts * oneTimeEvalPerAccount;
  const activationPassTotal = accounts * activationPerAccount;

  const firstTargetFunded = buffer + firstPayout;
  let daysToFirstFunded: number | null = null;
  let daysToRecurringFunded: number | null = null;
  if (evPerAccountFunded > 0) {
    daysToFirstFunded = Math.ceil(firstTargetFunded / evPerAccountFunded);
    daysToRecurringFunded = Math.ceil(recurringPayout / evPerAccountFunded);
  }

  const netFirstPerAcc = firstPayout * (split / 100);
  const netRecPerAcc = recurringPayout * (split / 100);

  const subCostPerAccEval =
    accountFeeRecurring && monthlyAcctFee > 0 && evalDaysPass != null
      ? evalSubBillPeriods * monthlyAcctFee
      : null;

  const negativeTrading = netDailyPerAccountFunded < 0;
  const negativeTradingEval = netDailyPerAccountEval < 0;
  const negativeAfterRecurring = afterRecurringMonthly < 0;

  const showFeeMonthly = accountFeeRecurring && monthlyAcctFee > 0;
  const showFeeEvalRecurring =
    !directToFunded &&
    accountFeeRecurring &&
    monthlyAcctFee > 0 &&
    evalDaysPass != null &&
    evalSubCostDuringEval > 0;
  const showFeeOneTimeEval = !accountFeeRecurring && oneTimeEvalPerAccount > 0;
  const showFeeActivation = activationPerAccount > 0;
  const showFeeRollup =
    oneTimeEvalPerAccount > 0 && activationPerAccount > 0;

  const showPlanEval = !directToFunded && evalProfitTarget > 0;
  const showPlanEvalMonths =
    !directToFunded &&
    evalDaysPass != null &&
    accountFeeRecurring &&
    monthlyAcctFee > 0;
  const showPlanFunded = evPerAccountFunded > 0;
  const showPlanPath = daysToFirstFunded != null && evPerAccountFunded > 0;

  let feeWarnMsg = "";
  if (
    accountFeeRecurring &&
    recurringCostMonthly > feeCompareMonthly &&
    feeCompareMonthly >= 0
  ) {
    feeWarnMsg =
      "Monthly account fees are larger than this trading month's after-split income—a cash-flow issue, not necessarily a bad gross edge.";
  } else if (negativeAfterRecurring && !negativeTradingEval) {
    feeWarnMsg =
      "Monthly account fees exceed your after-split income for a typical trading month; scale or fees may need another look.";
  }

  const netSplitCaption = directToFunded
    ? "Your share after the firm's profit split (no account fees yet). Direct to funded uses Core win/loss as funded assumptions."
    : scalingPlanPct >= 100
      ? "Your share after the firm's profit split (no account fees yet). Funded stage; 100% matches evaluation size."
      : `Your share after the firm's profit split (no account fees yet). Funded stage at ${scalingPlanPct}% scaling (evaluation length in Payouts still uses full size).`;

  const accountTypeNote = directToFunded
    ? "Direct to funded: one-time account fee only (no monthly billing or activation). Profit target and scaling plan are not used."
    : "Evaluation account: use profit target and scaling plan for time-to-pass and funded-stage sizing.";

  const resultsBreakdownNote = directToFunded
    ? "Net after split and payout take-home use profit split and Payouts settings. Trading rows use Core assumptions (direct to funded). Firm charges are in Spend planner."
    : "Net after split and payout take-home use profit split and Payouts settings. Trading rows use your scaling plan (funded). Firm charges are in Spend planner.";

  let timelineBannerHtml = directToFunded
    ? "<strong>Direct to funded:</strong> You start on a funded account from <strong>$0</strong> gross profit. Buffer and payouts build from your Core trading edge. There is no evaluation phase or profit target."
    : "<strong>Funded account starts at zero:</strong> After you pass, the funded account is modeled from <strong>$0</strong> gross profit. Buffer and first payout only build from <strong>new</strong> funded gross edge. Evaluation length uses the <strong>evaluation profit target</strong> in Firm and fees. Activation (if any) is money at pass, not during the evaluation.";
  if (!directToFunded && scalingPlanPct < 100) {
    timelineBannerHtml += ` <strong>Scaling ${scalingPlanPct}%:</strong> Results and funded timelines use reduced average win/loss; evaluation Step 1 still uses full size.`;
  }

  const keyLegendHtml = directToFunded
    ? "<strong>How to read this tool:</strong> <em>Trading days</em> are days you trade. A <em>trading month</em> here means that many trading days (your trading days per month setting). A <em>calendar month</em> is a real month on the calendar (used when your account fee bills monthly). <strong>Direct to funded</strong> skips evaluation; Results use your Core win/loss as funded assumptions. <strong>Funded consistency & risk</strong> uses payout amounts from <strong>Payouts</strong>. <strong>Spend planner</strong> lists timelines and firm fees separately."
    : "<strong>How to read this tool:</strong> <em>Trading days</em> are days you trade. A <em>trading month</em> here means that many trading days (your trading days per month setting). A <em>calendar month</em> is a real month on the calendar (used when your account fee bills monthly). <strong>Results</strong> show net after profit split for the <em>funded</em> stage using your <em>scaling plan</em> (100% matches evaluation size). Evaluation length in <strong>Payouts</strong> uses full evaluation edge. <strong>Consistency rule</strong> applies only on funded withdrawals. <strong>Spend planner</strong> lists timelines and firm fees separately.";

  const footerHtml =
    `The core calculator uses <strong>${tradingDaysPerMonth}</strong> trading days per month and <strong>${tradingDaysPerYear}</strong> trading days per year. ` +
    (directToFunded
      ? "If your account fee is recurring, billing is per <strong>calendar month</strong> per account."
      : "If your account fee is recurring, billing is per <strong>calendar month</strong> per account; estimated months in evaluation set how much recurring fee stacks up before pass.");

  const dashboardNote = directToFunded
    ? "Direct to funded: plan and timeline rows reflect funded account only. Real firms bill differently; this is a simple planning proxy."
    : "Calendar months in evaluation are estimated using your trading days per month setting. Real firms bill differently; this is a simple planning proxy.";

  const netSplitSectionLabel = `Net after ${split}% profit split`;

  let evalTimelineHtml: string;
  if (evalProfitTarget <= 0) {
    evalTimelineHtml =
      '<span class="text-muted">Set evaluation profit target in Firm and fees</span>';
  } else if (evPerAccount <= 0) {
    evalTimelineHtml =
      "Not available (expected gross per trading day is zero or negative)";
  } else {
    evalTimelineHtml = `${formatTradingDuration(evalDaysPass!, tradingDaysPerMonth)} gross edge to pass evaluation`;
    if (accountFeeRecurring && monthlyAcctFee > 0 && accounts > 0) {
      evalTimelineHtml += ` · ~${evalSubBillPeriods} calendar month(s) of fees · est. ${formatPlannerCurrency(evalSubCostDuringEval)} until pass`;
    }
  }

  let firstTimelineHtml: string;
  let recurringTimelineHtml: string;
  if (evPerAccountFunded > 0 && daysToFirstFunded != null) {
    firstTimelineHtml = `${formatTradingDuration(daysToFirstFunded, tradingDaysPerMonth)} buffer + first payout, gross, funded from zero`;
    if (!directToFunded && scalingPlanPct < 100) {
      firstTimelineHtml += ` (at ${scalingPlanPct}% scaling vs eval)`;
    }
    if (recurringPayout <= 0) {
      recurringTimelineHtml = "Set recurring payout amount in dollars";
    } else {
      const recMo = (daysToRecurringFunded! / tradingDaysPerMonth).toFixed(1);
      recurringTimelineHtml = `Every ${daysToRecurringFunded} trading days (~${recMo} mo between gross withdrawals on funded`;
      if (!directToFunded && scalingPlanPct < 100) {
        recurringTimelineHtml += ` at ${scalingPlanPct}% scaling`;
      }
      recurringTimelineHtml += ")";
    }
  } else {
    const fundedUnavailable =
      evPerAccount > 0 && evPerAccountFunded <= 0
        ? "Not available at this scaling (funded gross edge is zero or negative)"
        : "Not available (expected gross per trading day is zero or negative)";
    firstTimelineHtml = fundedUnavailable;
    recurringTimelineHtml = fundedUnavailable;
  }

  let consecutiveLossesText: string;
  if (lossFunded > 0 && maxDrawdown > 0) {
    const daysToBlow = Math.floor(maxDrawdown / lossFunded);
    consecutiveLossesText = `${formatTradingDuration(daysToBlow, tradingDaysPerMonth)} losing trading days in a row (estimate, funded avg loss${
      !directToFunded && scalingPlanPct < 100 ? ` at ${scalingPlanPct}% scale` : ""
    })`;
  } else {
    consecutiveLossesText = "Not available";
  }

  let consistencyAlertHtml: string | null = null;
  if (consistencyEnabled && consistencyPct > 0) {
    const maxFirstGross = firstPayout * (consistencyPct / 100);
    const maxRecurringGross = recurringPayout * (consistencyPct / 100);
    const avgWinFunded = profitFunded;
    const capBreaches: string[] = [];
    if (firstPayout > 0 && avgWinFunded > maxFirstGross) {
      capBreaches.push(
        `1st payout cap (${formatPlannerCurrency(maxFirstGross)}/winning day)`
      );
    }
    if (recurringPayout > 0 && avgWinFunded > maxRecurringGross) {
      capBreaches.push(
        `recurring cap (${formatPlannerCurrency(maxRecurringGross)}/winning day)`
      );
    }
    if (capBreaches.length > 0 && avgWinFunded > 0) {
      const winLabel =
        !directToFunded && scalingPlanPct < 100
          ? `${formatPlannerCurrency(avgWinFunded)} on funded (${scalingPlanPct}% of Core win)`
          : formatPlannerCurrency(avgWinFunded);
      consistencyAlertHtml = `Your average daily win (${winLabel}) is higher than the consistency max for ${capBreaches.join(" and ")}. Either decrease your average daily win in Core Trading Edge or increase your planned payout in Payouts & drawdown risk.`;
    }
  }

  return {
    tradingDaysPerMonth,
    tradingDaysPerYear,
    scalingPlanPct,
    fundedScale,
    profitFunded,
    lossFunded,
    evPerAccount,
    evPerAccountFunded,
    netDailyPerAccountEval,
    netDailyPerAccountFunded,
    tradingDailyTotal,
    tradingMonthlyTotal,
    tradingAnnualTotal,
    tradingMonthlyTotalEval,
    recurringCostMonthly,
    evalDaysPass,
    evalSubBillPeriods,
    evalSubCostDuringEval,
    feeCompareMonthly,
    afterRecurringMonthly,
    activationPerAccount,
    oneTimeEvalPerAccount,
    oneTimeEvalTotal,
    activationPassTotal,
    daysToFirstFunded,
    daysToRecurringFunded,
    netFirstPerAcc,
    netRecPerAcc,
    subCostPerAccEval,
    negativeTrading,
    negativeTradingEval,
    negativeAfterRecurring,
    showFeeMonthly,
    showFeeEvalRecurring,
    showFeeOneTimeEval,
    showFeeActivation,
    showFeeRollup,
    showPlanEval,
    showPlanEvalMonths,
    showPlanFunded,
    showPlanPath,
    feeWarnMsg,
    consistencyAlertHtml,
    consecutiveLossesText,
    evalTimelineHtml,
    firstTimelineHtml,
    recurringTimelineHtml,
    netSplitCaption,
    accountTypeNote,
    resultsBreakdownNote,
    timelineBannerHtml,
    keyLegendHtml,
    footerHtml,
    dashboardNote,
    netSplitSectionLabel,
  };
}
