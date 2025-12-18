const Account = require("../trade/account/account.model");
const Trade = require("../trade/trade.model");
const redis = require("./redis.helper");

/**
 * Promotes a demo account to live after passing challenge requirements
 * @param {String} accountId - The account ID to promote
 * @returns {Object} Promotion result with status and message
 */
async function promoteAccountToLive(accountId) {
  try {
    console.log(
      `[AccountPromotion] 🎉 Starting promotion process for account ${accountId}`
    );

    const account = await Account.findById(accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    // ✅ Step 1: Delete ALL trades associated with this account from MongoDB
    const deleteResult = await Trade.deleteMany({ accountId: accountId });
    console.log(
      `[AccountPromotion] Deleted ${deleteResult.deletedCount} demo trades`
    );

    // ✅ Step 2: Clean up ALL Redis data for this account
    await redis.deleteAccountRisk(accountId.toString());
    await redis.deleteAllTradePnLs(accountId.toString());
    await redis.deleteAccountSymbols(accountId.toString());
    console.log(
      `  [AccountPromotion] Deleted account risk and PnL data from Redis`
    );

    // ✅ Step 3: Delete all open trades from Redis
    const redisOpenTrades = await redis.getOpenTradesByAccount(
      accountId.toString()
    );
    for (const redisTrade of redisOpenTrades) {
      await redis.deleteOpenTrade(redisTrade._id);
      console.log(
        ` [AccountPromotion] Deleted Redis open trade: ${redisTrade._id}`
      );
    }

    // ✅ Step 4: Delete all pending orders from Redis
    const redisPendingOrders = await redis.getPendingOrdersByAccount(
      accountId.toString()
    );
    for (const order of redisPendingOrders) {
      await redis.deletePendingOrder(
        order._id,
        accountId.toString(),
        order.symbol
      );
      console.log(
        `[AccountPromotion] Deleted Redis pending order: ${order._id}`
      );
    }

    // ✅ Step 5: Update account to live with complete reset
    account.accountType = "live";
    account.status = "active";
    account.activelyTradedDays = 0;
    account.minTradingDays = 5;
    account.balance = account.initialBalance;
    account.equity = account.initialBalance;

    // Reset all trade arrays
    account.openPositions = [];
    account.closedPositions = [];
    account.pendingOrders = [];
    account.cancelledOrders = [];
    account.dailyProfits = [];

    // Reset margins
    account.marginUsed = 0;
    account.pendingMargin = 0;
    account.lastTradeTimestamp = null;
    account.dailyDrawdownLimit = account.initialBalance * 0.02; // 2%
    account.maxDrawdownLimit = account.initialBalance * 0.06; // 6%
    account.currentDayEquity = account.initialBalance;

    await account.save();
    console.log(`[AccountPromotion] Account updated to LIVE status`);

    // ✅ Step 6: Initialize fresh Redis data for live account
    const maxDrawdownThreshold =
      account.initialBalance - account.initialBalance * 0.06;
    await redis.setAccountRisk(accountId.toString(), {
      initialBalance: account.initialBalance,
      dailyDrawdownLimit: account.dailyDrawdownLimit,
      maxDrawdownLimit: account.maxDrawdownLimit,
      currentBalance: account.initialBalance,
      currentEquity: account.initialBalance,
      currentDailyLoss: 0,
      highestEquity: account.initialBalance,
      maxDrawdownThreshold,
      currentDayEquity: account.initialBalance,
    });
    console.log(`[AccountPromotion] Initialized fresh Redis data`);

    console.log(
      `[AccountPromotion] ✅ Account ${accountId} successfully promoted to LIVE. All demo data cleared. Starting fresh with balance: ${account.initialBalance}`
    );

    return {
      success: true,
      promoted: true,
      message: "Account promoted to live. All demo trades deleted.",
      accountId: accountId,
      newBalance: account.initialBalance,
      accountType: "live",
      status: "active",
    };
  } catch (error) {
    console.error(
      ` [AccountPromotion] Error promoting account ${accountId}:`,
      error
    );
    throw error;
  }
}

/**
 * Checks if account meets all requirements for promotion
 * @param {Object} account - The account document
 * @returns {Boolean} True if account should be promoted
 */
function shouldPromoteAccount(account) {
  const targetBalance = account.initialBalance + account.profitTarget;
  const hasMetTradingDays =
    account.activelyTradedDays >= account.minTradingDays;
  const hasMetProfitTarget = account.balance >= targetBalance;
  const isDemoAccount = account.accountType === "demo";

  const shouldPromote =
    isDemoAccount && hasMetTradingDays && hasMetProfitTarget;

  if (shouldPromote) {
    console.log(
      `     [AccountPromotion] Account ${account._id} meets promotion criteria:`,
      {
        tradingDays: account.activelyTradedDays,
        requiredDays: account.minTradingDays,
        currentBalance: account.balance,
        targetBalance,
        accountType: account.accountType,
      }
    );
  }

  return shouldPromote;
}

module.exports = {
  promoteAccountToLive,
  shouldPromoteAccount,
};
