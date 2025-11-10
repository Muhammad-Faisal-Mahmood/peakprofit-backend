const Trade = require("../trade.model");
const Account = require("../account/account.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

const TradeMonitor = require("../tradeMonitor.service");

const openTrade = async (req, res) => {
  try {
    const {
      accountId,
      symbol,
      polygonSymbol,
      market,
      side,
      units,
      entryPrice,
      stopLoss,
      takeProfit,
      leverage = 50,
    } = req.body;

    const userId = req.user.userId;
    console.log("User ID from JWT:", userId);

    if (!userId) {
      return sendErrorResponse(res, "User not authenticated.");
    }

    // Validate required fields
    if (
      !accountId ||
      !symbol ||
      !polygonSymbol ||
      !side ||
      !units ||
      !entryPrice
    ) {
      return sendErrorResponse(res, "Missing required trade parameters.");
    }

    // Fetch the account
    const account = await Account.findById(accountId);
    if (!account) return sendErrorResponse(res, "Account not found.");
    if (account.status == "failed" || account.status == "suspended") {
      return sendErrorResponse(
        res,
        `Account is ${account.status}. No new trades allowed.`
      );
    }

    // Calculate margin used (simplified)
    const marginUsed = (units * entryPrice) / leverage;

    // Check if account has enough free margin
    const freeMargin = account.balance - account.marginUsed;
    if (marginUsed > freeMargin) {
      return sendErrorResponse(
        res,
        "Not enough free margin to open this trade."
      );
    }

    // ✅ Handle Actively Traded Days logic
    const now = new Date();
    const today = now.toISOString().slice(0, 10); // format YYYY-MM-DD

    const isNewTradingDay =
      !account.lastTradeTimestamp ||
      account.lastTradeTimestamp.toISOString().slice(0, 10) !== today;

    if (isNewTradingDay) {
      // Increment active trading days only on first trade of the day
      account.activelyTradedDays += 1;

      // ✅ Reset daily baseline equity
      account.currentDayEquity = account.equity || account.balance;

      console.log(
        `[Account] New trading day detected for account ${account._id}. Daily baseline equity set to ${account.currentDayEquity}`
      );
    }

    // Always update last trade timestamp
    account.lastTradeTimestamp = now;

    // Create the trade
    const trade = new Trade({
      accountId,
      userId,
      symbol,
      polygonSymbol,
      market,
      side,
      units,
      tradeSize: units * entryPrice * leverage,
      entryPrice,
      stopLoss,
      takeProfit,
      leverage,
      marginUsed,
    });

    await trade.save();

    // Update account margin and open positions
    account.marginUsed += marginUsed;
    account.openPositions.push(trade._id);
    await account.save();

    // Add trade to monitoring service
    await TradeMonitor.addTradeForMonitoring(account, trade);

    return sendSuccessResponse(res, "Trade opened successfully.", trade);
  } catch (err) {
    console.error("Error opening trade:", err);
    return sendErrorResponse(res, "Failed to open trade.", err.message);
  }
};

module.exports = openTrade;
