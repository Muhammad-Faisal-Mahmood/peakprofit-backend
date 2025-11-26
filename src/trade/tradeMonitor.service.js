const Account = require("../trade/account/account.model");
const Trade = require("../trade/trade.model");
const redis = require("../utils/redis.helper");
const { polygonManager } = require("../polygon/polygonManager");
const closeTradeService = require("../utils/closeTrade.service");
const redisTradeCleanup = require("../utils/redisTradeCleanup");

async function addPendingOrderForMonitoring(accountDoc, orderDoc) {
  const accountId = accountDoc._id.toString();
  const orderId = orderDoc._id.toString();

  // Initialize account risk if needed (same as before)
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

  // Store pending order in Redis
  await redis.setPendingOrder(orderId, {
    _id: orderId,
    accountId: accountId,
    userId: orderDoc.userId.toString(),
    symbol: orderDoc.symbol,
    side: orderDoc.side,
    orderType: orderDoc.orderType,
    triggerPrice: orderDoc.triggerPrice,
    tradeSize: orderDoc.tradeSize,
    units: orderDoc.units,
    stopLoss: orderDoc.stopLoss,
    takeProfit: orderDoc.takeProfit,
    leverage: orderDoc.leverage,
    marginUsed: orderDoc.marginUsed,
    market: orderDoc.market,
  });

  console.log(
    `[TradeMonitor] Pending ${orderDoc.orderType} order ${orderId} added for monitoring.`
  );

  const channel = orderDoc.market === "crypto" ? "XT" : "C";
  console.log("channel in add pending order monitoring", channel);
  polygonManager.subscribe(
    `server_${accountId}`,
    orderDoc.market,
    orderDoc.symbol,
    channel
  );
}

async function addTradeForMonitoring(accountDoc, tradeDoc) {
  console.log(polygonManager, "polygonManager in addPendingOrderForMonitoring");
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
  const channel = tradeDoc.market === "crypto" ? "XT" : "C";
  console.log("channel in add trade monitoring", channel);
  polygonManager.subscribe(
    `server_${accountId}`,
    tradeDoc.market,
    tradeDoc.symbol,
    channel
  );

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

  await triggerUnsubscribeCheck(trade?.market, trade?.symbol);

  console.log(`[TradeMonitor] Trade ${tradeId} removed from monitoring.`);
}

async function checkAccountRules(accountId, newEquity) {
  const riskData = await redis.getAccountRisk(accountId);
  if (!riskData) return null;

  let violation = null;

  // Max Drawdown (Trailing 7%)
  if (newEquity < riskData.maxDrawdownThreshold) {
    violation = "maxDrawdown";
    return violation;
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
  // console.log(`\n[TradeMonitor] >>> Processing tick for ${symbol} at ${price}`);

  try {
    await checkPendingOrders(symbol, price);
    // Get all open trades for this symbol from Redis
    const trades = await redis.getOpenTradesBySymbol(symbol);

    if (!trades.length) {
      // console.log(`[TradeMonitor] No open trades for ${symbol}.`);
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
      // console.log("New Equity for Account", accountId, "is", newEquity);

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
          // await removeTradeFromMonitoring(trade._id, accountId);
        }
      }
    }
  } catch (err) {
    console.error(`[TradeMonitor][ERROR] Tick processing failed:`, err);
  }
}

async function closeTrade(trade, currentPrice, reason) {
  const { _id, accountId, symbol, market } = trade;

  await redisTradeCleanup({
    tradeId: _id.toString(),
    accountId: accountId.toString(),
    symbol,
    market,
  });

  return await closeTradeService(trade, currentPrice, reason);
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
    // await removeTradeFromMonitoring(trade._id, accountId);
  }

  // Clean up all Redis data for this account
  await redis.deleteAccountRisk(accountId);
  await redis.deleteAllTradePnLs(accountId);
  await redis.deleteAccountSymbols(accountId);

  console.log(
    `[LIQUIDATION] Account ${accountId} fully liquidated and cleaned up from Redis.`
  );
}

async function checkPendingOrders(symbol, currentPrice) {
  const pendingOrders = await redis.getPendingOrdersBySymbol(symbol);

  if (!pendingOrders.length) return;

  console.log(
    `[TradeMonitor] Checking ${pendingOrders.length} pending orders for ${symbol}`
  );

  for (const order of pendingOrders) {
    const { _id: orderId, accountId, orderType, triggerPrice, side } = order;

    let shouldExecute = false;

    // Check if order should trigger
    if (orderType === "limit") {
      // Limit Buy: Execute when price drops to or below trigger
      // Limit Sell: Execute when price rises to or above trigger
      if (side === "buy" && currentPrice <= triggerPrice) {
        shouldExecute = true;
      } else if (side === "sell" && currentPrice >= triggerPrice) {
        shouldExecute = true;
      }
    } else if (orderType === "stop") {
      // Stop Buy: Execute when price rises to or above trigger (buy breakout)
      // Stop Sell: Execute when price drops to or below trigger (sell breakdown)
      if (side === "buy" && currentPrice >= triggerPrice) {
        shouldExecute = true;
      } else if (side === "sell" && currentPrice <= triggerPrice) {
        shouldExecute = true;
      }
    }

    if (shouldExecute) {
      console.log(
        `[TradeMonitor] ${orderType.toUpperCase()} order ${orderId} triggered at ${currentPrice}`
      );
      await executePendingOrder(order, currentPrice);
    }
  }
}

async function executePendingOrder(order, executionPrice) {
  const {
    _id: orderId,
    accountId,
    symbol,
    side,
    units,
    stopLoss,
    takeProfit,
    leverage,
    marginUsed,
  } = order;

  try {
    // Fetch account

    const existingOrder = await redis.atomicDeletePendingOrder(
      orderId,
      accountId,
      symbol
    );
    console.log("existing order:", existingOrder);
    if (!existingOrder) {
      console.log(
        `[executePendingOrder] Order ${orderId} already executed or cancelled. Skipping.`
      );
      return;
    }
    const account = await Account.findById(accountId);
    if (!account) {
      console.error(`[executePendingOrder] Account ${accountId} not found`);
      return;
    }

    // Check if account is still valid
    if (account.status === "failed" || account.status === "suspended") {
      console.warn(
        `[executePendingOrder] Account ${accountId} is ${account.status}. Cancelling order.`
      );
      await cancelPendingOrder(orderId, accountId, symbol, "accountInvalid");
      return;
    }

    // Update trade in MongoDB
    const updatedTrade = await Trade.findByIdAndUpdate(
      orderId,
      {
        status: "open",
        entryPrice: executionPrice,
        executedAt: new Date(),
      },
      { new: true }
    );

    if (!updatedTrade) {
      console.error(`[executePendingOrder] Trade ${orderId} not found in DB`);
      return;
    }

    // Move margin from pending to used
    account.pendingMargin = Math.max(0, account.pendingMargin - marginUsed);
    account.marginUsed += marginUsed;

    // Move order from pending to open
    account.pendingOrders = account.pendingOrders.filter(
      (id) => id.toString() !== orderId.toString()
    );
    account.openPositions.push(orderId);

    await account.save();

    // Remove from pending orders in Redis
    await redis.deletePendingOrder(orderId, accountId, symbol);

    // Add to open trades monitoring
    await redis.setOpenTrade(orderId, {
      _id: orderId,
      accountId: accountId,
      userId: updatedTrade.userId.toString(),
      symbol: symbol,
      side: side,
      tradeSize: units * executionPrice * leverage,
      entryPrice: executionPrice,
      stopLoss: stopLoss,
      takeProfit: takeProfit,
      market: updatedTrade.market,
    });

    // Add symbol to active symbols
    await redis.addAccountSymbol(accountId, symbol);

    console.log(
      `[TradeMonitor] Order ${orderId} executed successfully at ${executionPrice}`
    );
  } catch (err) {
    console.error(
      `[executePendingOrder] Error executing order ${orderId}:`,
      err
    );
  }
}

async function cancelPendingOrder(orderId, accountId, symbol, reason) {
  // Update in MongoDB
  await Trade.findByIdAndUpdate(orderId, {
    status: "cancelled",
    tradeClosureReason: reason,
    closedAt: new Date(),
  });

  // Get order details to release margin
  const order = await redis.getPendingOrder(orderId);
  if (order) {
    const account = await Account.findById(accountId);
    if (account) {
      account.pendingMargin = Math.max(
        0,
        account.pendingMargin - order.marginUsed
      );

      // Move from pending to cancelled
      account.pendingOrders = account.pendingOrders.filter(
        (id) => id.toString() !== orderId.toString()
      );
      account.cancelledOrders.push(orderId);

      await account.save();
    }
  }

  // Remove from Redis
  await redis.deletePendingOrder(orderId, accountId, symbol);
  await triggerUnsubscribeCheck(order?.market, order?.symbol);
  console.log(`[TradeMonitor] Order ${orderId} cancelled. Reason: ${reason}`);
}

async function triggerUnsubscribeCheck(market, symbol, channel = "AM") {
  try {
    const subscriptionKey = `${market}:${symbol}:${channel}`;

    // Check if any clients are still subscribed
    const subscribers = polygonManager.subscriptions.get(subscriptionKey);
    const hasClientSubscribers = subscribers && subscribers.size > 0;

    if (hasClientSubscribers) {
      console.log(
        `[TradeMonitor] Keeping ${symbol} subscription - ${subscribers.size} client(s) still connected`
      );
      return;
    }

    // No clients subscribed, check if we should unsubscribe from Polygon
    // The unsubscribeFromPolygon method will check Redis
    await polygonManager.unsubscribeFromPolygon(market, symbol, channel);
  } catch (err) {
    console.error(
      `[TradeMonitor] Error triggering unsubscribe check for ${symbol}:`,
      err
    );
  }
}

module.exports = {
  addTradeForMonitoring,
  addPendingOrderForMonitoring, // NEW
  removeTradeFromMonitoring,
  processPriceUpdate,
  closeTrade,
  cancelPendingOrder, // NEW
  executePendingOrder, // NEW
  triggerUnsubscribeCheck, // NEW
};
