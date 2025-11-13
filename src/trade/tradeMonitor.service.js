const Account = require("../trade/account/account.model");
const Trade = require("../trade/trade.model");
const redis = require("../utils/redis.helper");

async function addTradeForMonitoring(accountDoc, tradeDoc) {
  const accountId = accountDoc._id.toString();
  const tradeId = tradeDoc._id.toString();

  // 1. Initialize Account Risk Data if not present in Redis
  const existingRiskData = await redis.getAccountRisk(accountId);

  if (!existingRiskData) {
    const maxDrawdownThreshold =
      accountDoc.initialBalance - accountDoc.initialBalance * 0.07;

    await redis.setAccountRisk(accountId, {
      initialBalance: accountDoc.initialBalance,
      dailyDrawdownLimit: accountDoc.dailyDrawdownLimit,
      maxDrawdownLimit: accountDoc.maxDrawdownLimit,
      currentBalance: accountDoc.balance,
      currentEquity: accountDoc.equity,
      currentDailyLoss: 0,
      highestEquity: accountDoc.equity,
      maxDrawdownThreshold,
      currentDayEquity: accountDoc.currentDayEquity,
    });
  }

  // 2. Add symbol to account's active symbols
  await redis.addAccountSymbol(accountId, tradeDoc.symbol);

  // 3. Store trade in Redis
  await redis.setOpenTrade(tradeId, {
    _id: tradeId,
    accountId: accountId,
    userId: tradeDoc.userId.toString(),
    symbol: tradeDoc.symbol,
    side: tradeDoc.side,
    tradeSize: tradeDoc.tradeSize,
    entryPrice: tradeDoc.entryPrice,
    stopLoss: tradeDoc.stopLoss,
    takeProfit: tradeDoc.takeProfit,
    market: tradeDoc.market,
  });

  console.log(
    `[TradeMonitor] Trade ${tradeId} added for real-time monitoring.`
  );
}

async function removeTradeFromMonitoring(tradeId, accountId) {
  const trade = await redis.getOpenTrade(tradeId);
  if (!trade) return;

  // Delete trade from Redis
  await redis.deleteOpenTrade(tradeId);

  // Delete PnL entry
  await redis.deleteTradePnL(accountId, tradeId);

  // Check if other open trades use this symbol before removing it
  const allAccountTrades = await redis.getOpenTradesByAccount(accountId);
  const symbolStillInUse = allAccountTrades.some(
    (t) => t.symbol === trade.symbol && t._id !== tradeId
  );

  if (!symbolStillInUse) {
    await redis.removeAccountSymbol(accountId, trade.symbol);
  }

  console.log(`[TradeMonitor] Trade ${tradeId} removed from monitoring.`);
}

async function checkAccountRules(accountId, newEquity) {
  const riskData = await redis.getAccountRisk(accountId);
  if (!riskData) return null;

  let violation = null;

  // Max Drawdown (Trailing 7%)
  if (newEquity < riskData.maxDrawdownThreshold) {
    violation = "maxDrawdown";
  }

  const dailyLoss = riskData.currentDayEquity - newEquity;
  const dailyDrawdownThreshold = riskData.currentDayEquity * 0.025;

  // Daily Loss (2.5%)
  if (dailyLoss > dailyDrawdownThreshold) {
    violation = violation || "dailyDrawdown";
    console.warn(
      `[TradeMonitor] ⚠️ Daily drawdown exceeded! Loss: ${dailyLoss.toFixed(
        2
      )} > Threshold: ${dailyDrawdownThreshold.toFixed(2)}`
    );
  }

  return violation;
}

async function processPriceUpdate(priceData) {
  const { symbol, price } = priceData;
  console.log(`\n[TradeMonitor] >>> Processing tick for ${symbol} at ${price}`);

  try {
    // Get all open trades for this symbol from Redis
    const trades = await redis.getOpenTradesBySymbol(symbol);

    if (!trades.length) {
      console.log(`[TradeMonitor] No open trades for ${symbol}.`);
      return;
    }

    // Track which accounts are impacted by this price
    const affectedAccounts = new Map();

    for (const trade of trades) {
      const tradeId = trade._id;
      const {
        side,
        entryPrice,
        stopLoss,
        takeProfit,
        tradeSize,
        leverage = 50,
        accountId,
      } = trade;

      let hitSL = false;
      let hitTP = false;

      // Check SL/TP
      if (side === "buy") {
        if (price <= stopLoss) hitSL = true;
        if (price >= takeProfit) hitTP = true;
      } else {
        if (price >= stopLoss) hitSL = true;
        if (price <= takeProfit) hitTP = true;
      }

      // Calculate and update unrealized PnL in Redis
      const direction = side === "buy" ? 1 : -1;
      const symbolAmount = tradeSize / entryPrice;
      const pnl = (price - entryPrice) * symbolAmount * direction;

      await redis.setTradePnL(accountId, tradeId, pnl);

      // Track affected accounts
      if (!affectedAccounts.has(accountId)) {
        affectedAccounts.set(accountId, { trades: [], hasSlTpHit: false });
      }
      const accountData = affectedAccounts.get(accountId);
      accountData.trades.push({ trade, hitSL, hitTP, pnl });
      if (hitSL || hitTP) {
        accountData.hasSlTpHit = true;
      }
    }

    // Check drawdown rules for ALL affected accounts BEFORE closing any trades
    const accountsToLiquidate = new Set();

    for (const [accountId, accountData] of affectedAccounts) {
      const riskData = await redis.getAccountRisk(accountId);
      if (!riskData) continue;

      const totalOpenPnl = await redis.getTotalOpenPnl(accountId);

      // Compute in-memory equity
      const newEquity =
        (riskData.currentBalance || riskData.initialBalance) + totalOpenPnl;
      console.log("New Equity for Account", accountId, "is", newEquity);

      // Update current equity in Redis
      await redis.updateAccountRisk(accountId, { currentEquity: newEquity });

      // Check rules
      const violation = await checkAccountRules(accountId, newEquity);

      if (violation) {
        console.warn(
          `[TradeMonitor] Account ${accountId} violated ${violation} rule. Marking for liquidation.`
        );
        accountsToLiquidate.add(accountId);
        affectedAccounts.get(accountId).violation = violation;
      }
    }

    // Handle liquidations FIRST
    for (const accountId of accountsToLiquidate) {
      const accountData = affectedAccounts.get(accountId);
      const riskData = await redis.getAccountRisk(accountId);
      await handleAccountLiquidation(
        accountId,
        accountData.violation,
        riskData.currentEquity,
        priceData
      );
    }

    // Only close individual SL/TP trades if account was NOT liquidated
    for (const [accountId, accountData] of affectedAccounts) {
      if (accountsToLiquidate.has(accountId)) {
        continue;
      }

      // Close individual trades that hit SL/TP
      for (const { trade, hitSL, hitTP } of accountData.trades) {
        if (hitSL || hitTP) {
          const closureReason = hitSL ? "stopLossHit" : "takeProfitHit";
          console.log(
            `[TradeMonitor] Trade ${trade._id} hit ${closureReason}. Closing...`
          );

          await closeTrade(trade, price, closureReason);
          await removeTradeFromMonitoring(trade._id, accountId);
        }
      }
    }
  } catch (err) {
    console.error(`[TradeMonitor][ERROR] Tick processing failed:`, err);
  }
}

async function closeTrade(trade, currentPrice, reason) {
  const { side, entryPrice, tradeSize, leverage = 50, _id, accountId } = trade;

  const direction = side === "buy" ? 1 : -1;
  const symbolAmount = tradeSize / entryPrice;
  const pnl = (currentPrice - entryPrice) * symbolAmount * direction;

  const account = await Account.findById(accountId);
  if (!account) {
    console.error(`[closeTrade] Account ${accountId} not found`);
    return;
  }

  const marginToRelease = (tradeSize * entryPrice) / leverage;
  account.marginUsed = Math.max(0, account.marginUsed - marginToRelease);
  account.balance += pnl;
  account.equity = account.balance;

  // Proper array manipulation
  if (Array.isArray(account.openPositions)) {
    account.openPositions = account.openPositions.filter(
      (posId) => posId.toString() !== _id.toString()
    );
  }
  if (Array.isArray(account.closedPositions)) {
    account.closedPositions.push(_id);
  }

  await account.save();

  const updateData = {
    status: "closed",
    exitPrice: currentPrice,
    closedAt: new Date(),
    profit: pnl,
    tradeClosureReason: reason,
  };

  if (["dailyDrawdown", "maxDrawdown"].includes(reason)) {
    updateData.$push = { violatedRules: reason };
  }

  await Trade.findByIdAndUpdate(_id, updateData);

  console.log(
    `[TradeMonitor] Trade ${_id} closed at ${currentPrice}. Reason: ${reason}, PnL: ${pnl.toFixed(
      2
    )}`
  );
}

async function handleAccountLiquidation(
  accountId,
  violationRule,
  finalEquity,
  priceData
) {
  console.warn(
    `[LIQUIDATION] Account ${accountId} failed due to ${violationRule}.`
  );

  // Update the Account status to 'failed'
  await Account.findByIdAndUpdate(accountId, {
    status: "failed",
    equity: finalEquity,
  });

  // Close ALL open positions at the current price
  const tradesToClose = await redis.getOpenTradesByAccount(accountId);

  console.log(
    `[LIQUIDATION] Closing ${tradesToClose.length} trades for account ${accountId}`
  );

  const closureReason =
    violationRule === "dailyDrawdown"
      ? "dailyDrawdownViolated"
      : "maxDrawdownViolated";

  // Close all trades
  for (const trade of tradesToClose) {
    const currentPrice = priceData.price;

    await closeTrade(trade, currentPrice, closureReason);
    await removeTradeFromMonitoring(trade._id, accountId);
  }

  // Clean up all Redis data for this account
  await redis.deleteAccountRisk(accountId);
  await redis.deleteAllTradePnLs(accountId);
  await redis.deleteAccountSymbols(accountId);

  console.log(
    `[LIQUIDATION] Account ${accountId} fully liquidated and cleaned up from Redis.`
  );
}

module.exports = {
  addTradeForMonitoring,
  removeTradeFromMonitoring,
  processPriceUpdate,
  closeTrade,
};
