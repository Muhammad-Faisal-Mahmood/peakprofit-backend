const Account = require("../account.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../shared/response.service");
const Trade = require("../../trade.model");

const getStatsPageData = async (req, res) => {
  try {
    const { accountId } = req.params;
    const userId = req.user.userId;

    let accounts = [];
    let closedTrades = [];

    if (accountId === "all") {
      // All user accounts scenario
      accounts = await Account.find({ userId });

      if (accounts.length === 0) {
        return sendSuccessResponse(res, "No accounts found for user", {
          calendarData: [],
          pieChartData: processPieChartData([]),
          statistics: getEmptyStats(),
        });
      }

      // Get closed trades for all user accounts
      const accountIds = accounts.map((acc) => acc._id);
      closedTrades = await Trade.find({
        accountId: { $in: accountIds },
        status: "closed",
        closedAt: { $exists: true },
      }).sort({ closedAt: 1 });
    } else {
      // Single account scenario
      const account = await Account.findById(accountId);
      if (!account) {
        return sendErrorResponse(res, "Account not found");
      }

      if (userId !== account.userId.toString()) {
        return sendErrorResponse(res, "User not authorized to access account");
      }

      accounts = [account];

      // Get closed trades for this specific account
      closedTrades = await Trade.find({
        accountId,
        status: "closed",
        closedAt: { $exists: true },
      }).sort({ closedAt: 1 });
    }

    // Process calendar data (daily P&L aggregation)
    const calendarData = processCalendarData(closedTrades);

    // Process pie chart data (win/loss distribution)
    const pieChartData = processPieChartData(calendarData);

    // Calculate overall statistics
    const statistics = calculateOverallStats(accounts, closedTrades);

    return sendSuccessResponse(
      res,
      "Calendar and stats data retrieved successfully",
      {
        calendarData,
        pieChartData,
        statistics,
        accountCount: accounts.length,
      }
    );
  } catch (error) {
    console.error("Error fetching calendar stats:", error);
    return sendErrorResponse(res, "Failed to fetch calendar stats");
  }
};

function processCalendarData(closedTrades) {
  // Group trades by date
  const dailyStats = {};

  closedTrades.forEach((trade) => {
    const dateKey = trade.closedAt.toISOString().slice(0, 10); // YYYY-MM-DD

    if (!dailyStats[dateKey]) {
      dailyStats[dateKey] = {
        date: dateKey,
        pnl: 0,
        tradeCount: 0,
      };
    }

    dailyStats[dateKey].pnl += trade.pnl;
    dailyStats[dateKey].tradeCount += 1;
  });

  // Convert to array format expected by frontend
  return Object.values(dailyStats).map((day) => ({
    date: day.date,
    pnl: Math.round(day.pnl),
    tradeCount: day.tradeCount,
  }));
}

function processPieChartData(calendarData) {
  if (calendarData.length === 0) {
    return [
      { name: "Profitable Days", value: 0, color: "#4ADE80" },
      { name: "Losing Days", value: 0, color: "#F87171" },
      { name: "Breakeven Days", value: 0, color: "#818CF8" },
    ];
  }

  let profitableDays = 0;
  let losingDays = 0;
  let breakevenDays = 0;

  calendarData.forEach((day) => {
    if (day.pnl > 0) {
      profitableDays++;
    } else if (day.pnl < 0) {
      losingDays++;
    } else {
      breakevenDays++;
    }
  });

  const totalDays = calendarData.length;
  const profitablePercentage = (profitableDays / totalDays) * 100;
  const losingPercentage = (losingDays / totalDays) * 100;
  const breakevenPercentage = (breakevenDays / totalDays) * 100;

  return [
    {
      profitableDays: parseFloat(profitablePercentage.toFixed(1)),
      losingDays: parseFloat(losingPercentage.toFixed(1)),
      breakevenDays: parseFloat(breakevenPercentage.toFixed(1)),
    },
  ];
}

function getEmptyStats() {
  return {
    totalPnL: 0,
    winRate: 0,
    avgWin: 0,
    avgLoss: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    bestTrade: null,
    worstTrade: null,
    profitFactor: 0,
  };
}

function calculateOverallStats(accounts, closedTrades) {
  if (closedTrades.length === 0) {
    return getEmptyStats();
  }

  let winningTrades = 0;
  let losingTrades = 0;
  let totalGrossProfit = 0;
  let totalGrossLoss = 0;
  let bestTrade = { profit: -Infinity, trade: null };
  let worstTrade = { profit: Infinity, trade: null };

  closedTrades.forEach((trade) => {
    if (trade.pnl > 0) {
      winningTrades++;
      totalGrossProfit += trade.pnl;
    } else if (trade.pnl < 0) {
      losingTrades++;
      totalGrossLoss += Math.abs(trade.pnl);
    }

    // Track best trade
    if (trade.pnl > bestTrade.profit) {
      bestTrade = { profit: trade.pnl, trade };
    }

    // Track worst trade
    if (trade.pnl < worstTrade.profit) {
      worstTrade = { profit: trade.pnl, trade };
    }
  });

  const totalTrades = closedTrades.length;
  const winRate = (winningTrades / totalTrades) * 100;
  const avgWin = winningTrades > 0 ? totalGrossProfit / winningTrades : 0;
  const avgLoss = losingTrades > 0 ? totalGrossLoss / losingTrades : 0;
  const profitFactor =
    totalGrossLoss > 0 ? totalGrossProfit / totalGrossLoss : 0;

  // Calculate total P&L across all accounts
  let totalPnL = 0;
  accounts.forEach((account) => {
    totalPnL += account.balance - account.initialBalance;
  });

  return {
    totalPnL: Math.round(totalPnL),
    winRate: parseFloat(winRate.toFixed(1)),
    avgWin: Math.round(avgWin),
    avgLoss: Math.round(avgLoss),
    totalTrades,
    winningTrades,
    losingTrades,
    bestTrade:
      bestTrade.profit !== -Infinity ? Math.round(bestTrade.profit) : 0,
    worstTrade:
      worstTrade.profit !== Infinity ? Math.round(worstTrade.profit) : 0,
    profitFactor: parseFloat(profitFactor.toFixed(2)),
  };
}

module.exports = getStatsPageData;
