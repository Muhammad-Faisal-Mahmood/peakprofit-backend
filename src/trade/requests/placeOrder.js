const Trade = require("../trade.model");
const Account = require("../account/account.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const redis = require("../../utils/redis.helper");

const TradeMonitor = require("../tradeMonitor.service");
const calculateSpread = require("../../utils/calculateSpread");

const placeOrder = async (req, res) => {
  try {
    const {
      accountId,
      symbol,
      polygonSymbol,
      market,
      side,
      units,
      orderType = "market", // NEW
      triggerPrice, // NEW - required for limit/stop
      // entryPrice, // For market orders, this is current price
      stopLoss,
      takeProfit,
      leverage = 50,
    } = req.body;

    const userId = req.user.userId;
    const price = await redis.getSymbolPrice(symbol);
    const entryPrice = Number(price?.price);

    if (!entryPrice) {
      return sendErrorResponse(res, "Service unavailable at the moment");
    }

    // user Validation
    if (!userId) {
      return sendErrorResponse(res, "User not authenticated.");
    }
    //req validation
    if (!accountId || !symbol || !polygonSymbol || !side || !units) {
      return sendErrorResponse(res, "Missing required order parameters.");
    }

    // Validate order-type specific fields
    if (orderType === "limit" || orderType === "stop") {
      if (!triggerPrice) {
        return sendErrorResponse(
          res,
          `Trigger price required for ${orderType} orders.`
        );
      }
    }

    // if (orderType === "market" && !entryPrice) {
    //   return sendErrorResponse(res, "Entry price required for market orders.");
    // }

    // Fetch account
    const account = await Account.findById(accountId);
    if (!account) return sendErrorResponse(res, "Account not found.");
    if (units * entryPrice > account.balance * 0.5) {
      return sendErrorResponse(res, "Trade exceeds the 50% per-order limit.");
    }

    if (account.status != "active" && account.status != "passed") {
      return sendErrorResponse(
        res,
        `Account is ${account.status}. No new orders allowed.`
      );
    }

    // Calculate margin based on order type
    const priceForMargin = orderType === "market" ? entryPrice : triggerPrice;
    const marginUsed = units * priceForMargin;

    // Check free margin
    const freeMargin = account.balance - account.marginUsed;
    if (marginUsed > freeMargin) {
      return sendErrorResponse(
        res,
        "Not enough free margin to place this order."
      );
    }

    // Handle trading day logic
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const isNewTradingDay =
      !account.lastTradeTimestamp ||
      account.lastTradeTimestamp.toISOString().slice(0, 10) !== today;

    if (isNewTradingDay) {
      account.activelyTradedDays += 1;

      account.currentDayEquity = account.equity || account.balance;
      console.log(
        `[Account] New trading day for account ${account._id}. Baseline: ${account.currentDayEquity}`
      );

      const startingBalance = account.balance;
      const profitAmount = account.balance - startingBalance;
      const profitPercentage = (profitAmount / startingBalance) * 100;

      account.dailyProfits.push({
        date: new Date(),
        startingBalance: startingBalance,
        endingBalance: account.balance,
        profitAmount: profitAmount,
        profitPercentage: profitPercentage,
        meetsMinimum: profitPercentage >= 0.5,
      });
    }

    account.lastTradeTimestamp = now;

    // Create the order/trade
    const orderData = {
      accountId,
      userId,
      symbol,
      polygonSymbol,
      market,
      side,
      units,
      orderType,
      tradeSize: units * priceForMargin * leverage,
      leverage,
      marginUsed,
      stopLoss,
      takeProfit,
      status: orderType === "market" ? "open" : "pending",
    };

    // Set appropriate price fields
    if (orderType === "market") {
      orderData.entryPrice = entryPrice;
      orderData.executedAt = now;
    } else {
      orderData.triggerPrice = triggerPrice;
    }

    const trade = new Trade(orderData);
    await trade.save();

    // Handle based on order type

    if (orderType === "market") {
      // Immediate execution - existing logic
      account.marginUsed += marginUsed;
      account.openPositions.push(trade._id);
      const spread = 50 * calculateSpread(market, units, entryPrice);
      console.log("spread in place order: ", spread);
      account.balance -= spread;
      account.equity -= spread;
      await account.save();

      await TradeMonitor.addTradeForMonitoring(account, trade);

      return sendSuccessResponse(
        res,
        "Market order executed successfully.",
        trade
      );
    } else {
      account.pendingMargin += marginUsed; // Changed from marginUsed
      account.pendingOrders.push(trade._id); // NEW
      await account.save();

      await TradeMonitor.addPendingOrderForMonitoring(account, trade);

      return sendSuccessResponse(
        res,
        `${
          orderType.charAt(0).toUpperCase() + orderType.slice(1)
        } order placed successfully.`,
        trade
      );
    }
  } catch (err) {
    console.error("Error placing order:", err);
    return sendErrorResponse(res, "Failed to place order.");
  }
};

module.exports = placeOrder;
