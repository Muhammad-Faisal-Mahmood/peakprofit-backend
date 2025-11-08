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
      volume,
      entryPrice,
      stopLoss,
      takeProfit,
      leverage,
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
      !volume ||
      !entryPrice
    ) {
      return sendErrorResponse(res, "Missing required trade parameters.");
    }

    // Fetch the account
    const account = await Account.findById(accountId);
    if (!account) return sendErrorResponse(res, "Account not found.");

    // Calculate margin used (simplified)
    const marginUsed = (volume * entryPrice) / leverage;

    // Check if account has enough free margin
    const freeMargin = account.balance - account.marginUsed;
    if (marginUsed > freeMargin) {
      return sendErrorResponse(
        res,
        "Not enough free margin to open this trade."
      );
    }

    // Create the trade
    const trade = new Trade({
      accountId,
      userId,
      symbol,
      polygonSymbol,
      market,
      side,
      volume,
      entryPrice,
      stopLoss,
      takeProfit,
      leverage,
      marginUsed,
    });

    await trade.save();

    // Update account: margin used + add trade to openPositions
    account.marginUsed += marginUsed;
    account.openPositions.push(trade._id);
    await account.save();

    // Add trade to monitoring
    await TradeMonitor.addTradeForMonitoring(account, trade);

    return sendSuccessResponse(res, "Trade opened successfully.", trade);
  } catch (err) {
    console.error("Error opening trade:", err);
    return sendErrorResponse(res, "Failed to open trade.", err.message);
  }
};

module.exports = openTrade;
