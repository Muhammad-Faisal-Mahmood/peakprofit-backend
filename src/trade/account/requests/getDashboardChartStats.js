// Backend API Route
// Place this in your routes file (e.g., routes/account.js)

const Account = require("../account.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../shared/response.service");
const Trade = require("../../trade.model");
const { getSymbolPrice } = require("../../../utils/redis.helper");

const getDashboardChartStats = async (req, res) => {
  try {
    const { accountId } = req.params;

    // Verify account exists and populate open positions
    const account = await Account.findById(accountId).populate("openPositions");
    if (!account) {
      return sendErrorResponse(res, "Account not found");
    }

    // Get all closed trades for this account, sorted by closing date
    const closedTrades = await Trade.find({
      accountId,
      status: "closed",
      closedAt: { $exists: true },
    }).sort({ closedAt: 1 });

    // Calculate balance and equity progression over time
    let runningBalance = account.initialBalance;
    let dataPoints = [];

    // Start with initial values at account creation
    dataPoints.push({
      date: account.createdAt,
      balance: runningBalance,
      equity: runningBalance,
    });

    // Process each closed trade
    for (const trade of closedTrades) {
      runningBalance += trade.profit;

      dataPoints.push({
        date: trade.closedAt,
        balance: runningBalance,
        equity: runningBalance, // At close, equity equals balance
      });
    }

    // Calculate current equity including open positions
    let totalUnrealizedPnL = 0;

    for (const openTrade of account.openPositions) {
      // Get current price from Redis, fallback to entry price
      const priceData = await getSymbolPrice(openTrade.symbol);
      const currentPrice = priceData?.price || openTrade.entryPrice;

      // Calculate unrealized P&L
      let unrealizedPnL = 0;
      if (openTrade.side === "buy") {
        unrealizedPnL = (currentPrice - openTrade.entryPrice) * openTrade.units;
      } else {
        // sell
        unrealizedPnL = (openTrade.entryPrice - currentPrice) * openTrade.units;
      }

      totalUnrealizedPnL += unrealizedPnL;
    }

    // Add current state
    const currentEquity = account.balance + totalUnrealizedPnL;
    if (account.openPositions.length > 0) {
      dataPoints.push({
        date: new Date(),
        balance: account.balance,
        equity: currentEquity,
      });
    }

    // Filter to last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const filteredData = dataPoints.filter(
      (point) => new Date(point.date) >= thirtyDaysAgo
    );

    // If no data in the last 30 days, return empty arrays
    if (filteredData.length === 0) {
      return sendSuccessResponse(res, "Chart data retrieved successfully", {
        equityData: [],
        balanceData: [],
        dates: [],
        minValue: account.initialBalance,
        maxValue: account.initialBalance,
        accountInfo: {
          initialBalance: account.initialBalance,
          currentBalance: account.balance,
          currentEquity: currentEquity,
          status: account.status,
          openPositions: account.openPositions.length,
        },
      });
    }

    // Extract arrays for the chart (only actual data points, no filling)
    const equityData = filteredData.map((d) => Math.round(d.equity));
    const balanceData = filteredData.map((d) => Math.round(d.balance));
    const dates = filteredData.map((d) => d.date);

    // Calculate min and max values
    const allValues = [...equityData, ...balanceData];
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);

    return sendSuccessResponse(res, "Chart data retrieved successfully", {
      equityData,
      balanceData,
      dates,
      minValue,
      maxValue,
      accountInfo: {
        initialBalance: account.initialBalance,
        currentBalance: account.balance,
        currentEquity: currentEquity,
        status: account.status,
        openPositions: account.openPositions.length,
        unrealizedPnL: Math.round(totalUnrealizedPnL),
      },
    });
  } catch (error) {
    console.error("Error fetching chart data:", error);
    return sendErrorResponse(res, "Failed to fetch chart data");
  }
};

module.exports = getDashboardChartStats;
