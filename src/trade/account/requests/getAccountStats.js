const Account = require("../account.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../shared/response.service");
const Trade = require("../../trade.model");

const getAccountStats = async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await Account.findById(accountId);
    if (!account) return sendErrorResponse(res, "Account not found");

    // Get all closed trades for calculations
    const closedTrades = await Trade.find({
      accountId,
      status: "closed",
    }).sort({ closedAt: 1 });

    // Calculate statistics
    const stats = calculateStatistics(account, closedTrades);

    return sendSuccessResponse(res, "Account stats retrieved", stats);
  } catch (err) {
    console.error(err);
    return sendErrorResponse(res, "Failed to get stats");
  }
};

function calculateStatistics(account, closedTrades) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Initialize counters
  let totalTrades = closedTrades.length;
  let winningTrades = 0;
  let losingTrades = 0;
  let totalGrossProfit = 0;
  let totalGrossLoss = 0;
  let totalVolume = 0;
  let totalDuration = 0;
  let dailyPnL = 0;
  let highestDayProfit = { profit: 0, date: null };

  // Group by day for daily stats
  const dailyStats = {};

  closedTrades.forEach((trade) => {
    const tradeDate = trade.closedAt.toISOString().slice(0, 10);

    // Win/Loss tracking
    if (trade.profit > 0) {
      winningTrades++;
      totalGrossProfit += trade.profit;
    } else if (trade.profit < 0) {
      losingTrades++;
      totalGrossLoss += Math.abs(trade.profit);
    }

    // Volume
    totalVolume += trade.units;

    // Duration (in minutes)
    if (trade.closedAt && trade.openedAt) {
      totalDuration += (trade.closedAt - trade.openedAt) / (1000 * 60);
    }

    // Daily tracking
    if (!dailyStats[tradeDate]) {
      dailyStats[tradeDate] = { profit: 0, trades: 0 };
    }
    dailyStats[tradeDate].profit += trade.profit;
    dailyStats[tradeDate].trades++;

    // Today's P&L
    if (tradeDate === today) {
      dailyPnL += trade.profit;
    }
  });

  // Find highest profit day
  Object.entries(dailyStats).forEach(([date, data]) => {
    if (data.profit > highestDayProfit.profit) {
      highestDayProfit = { profit: data.profit, date };
    }
  });

  // Calculate derived metrics
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const profitFactor =
    totalGrossLoss > 0 ? totalGrossProfit / totalGrossLoss : 0;
  const avgTradeDuration = totalTrades > 0 ? totalDuration / totalTrades : 0;
  const overallPnL = account.balance - account.initialBalance;
  const overallPnLPercent = (
    (overallPnL / account.initialBalance) *
    100
  ).toFixed(2);

  // Consistency Rule
  const suggestedDailyProfit = account.profitTarget / account.minTradingDays;
  const suggestedDailyProfitPercent = (
    (suggestedDailyProfit / account.initialBalance) *
    100
  ).toFixed(2);
  const highestDayProfitPercent = (
    (highestDayProfit.profit / account.initialBalance) *
    100
  ).toFixed(2);

  // Max Drawdown calculations
  const dailyDrawdownRemaining =
    account.dailyDrawdownLimit - (account.currentDayEquity - account.equity);
  const maxDrawdownRemaining =
    account.maxDrawdownLimit - (account.initialBalance - account.balance);
  const profitTargetRemaining = account.profitTarget - overallPnL;

  return {
    // Basic account info
    balance: account.balance,
    equity: account.equity,
    accountSize: account.initialBalance,
    leverage: account.leverage,

    // Daily metrics
    dailyPnL,
    dailyPnLPercent: ((dailyPnL / account.balance) * 100).toFixed(2),
    dailyLowestEquity: account.dailyLowestEquity || account.equity,

    // Overall performance
    overallPnL,
    overallPnLPercent,

    // Best day
    highestProfitDay: {
      profit: highestDayProfit.profit,
      profitPercent: (
        (highestDayProfit.profit / account.initialBalance) *
        100
      ).toFixed(2),
      date: highestDayProfit.date,
    },

    // Trading statistics
    statistics: {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: winRate.toFixed(2),
      profitFactor: profitFactor.toFixed(2),
      totalVolume: totalVolume.toFixed(2),
      averageTradeDuration: Math.round(avgTradeDuration), // minutes
    },

    // Risk metrics
    tradingDays: {
      current: account.activelyTradedDays,
      required: account.minTradingDays,
    },

    // Challenge rules
    rules: {
      maxDailyDrawdown: {
        limit: account.dailyDrawdownLimit,
        remaining: dailyDrawdownRemaining,
        status: dailyDrawdownRemaining > 0 ? "passing" : "violated",
      },
      maxDrawdown: {
        limit: account.maxDrawdownLimit,
        remaining: maxDrawdownRemaining,
        status: maxDrawdownRemaining > 0 ? "passing" : "violated",
      },
      profitTarget: {
        target: account.profitTarget,
        remaining: profitTargetRemaining,
        status: profitTargetRemaining <= 0 ? "achieved" : "pending",
      },
      consistency: {
        suggestedDailyProfit,
        suggestedDailyProfitPercent,
        highestDayProfit: highestDayProfit.profit,
        highestDayProfitPercent,
      },
    },
  };
}

module.exports = getAccountStats;
