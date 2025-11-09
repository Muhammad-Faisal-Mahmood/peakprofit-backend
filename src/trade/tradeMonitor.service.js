const Account = require("../trade/account/account.model");
const Trade = require("../trade/trade.model");

// In-memory map to store critical trade and account info:
// Key: tradeId (string)
// Value: { accountId, userId, symbol, side, volume, entryPrice, contractMultiplier, dailyLossThresholdPrice, maxDrawdownThresholdPrice }
const openTradesMap = new Map();

// In-memory map to store account-level risk parameters:
// Key: accountId (string)
// Value: {
//    initialBalance: number,
//    dailyDrawdownLimit: number, // dollar amount of 2.5% loss
//    maxDrawdownLimit: number, // dollar amount of 7% loss (static or trailing)
//    currentDailyLoss: number, // realized loss for the day (resets daily)
//    highestEquity: number,
//    maxDrawdownThreshold: number, // highestEquity - (initialBalance * 0.07)
//    openPositionsPnl: Map<string, number>, // tradeId -> unrealizedPnl
//    symbolsInUse: Set<string> // Track which symbols have open trades
// }
const accountRiskMap = new Map();

/**
 * Calculates the total unrealized PnL for an account.
 * @param {string} accountId
 * @returns {number}
 */
function getTotalOpenPnl(accountId) {
  const riskData = accountRiskMap.get(accountId);
  if (!riskData) return 0;

  let totalPnl = 0;
  for (const pnl of riskData.openPositionsPnl.values()) {
    totalPnl += pnl;
  }
  return totalPnl;
}

/**
 * Loads and prepares a trade for real-time monitoring.
 * Called immediately after a trade is successfully opened and saved to MongoDB.
 * @param {object} accountDoc - The Mongoose Account document
 * @param {object} tradeDoc - The Mongoose Trade document
 */
async function addTradeForMonitoring(accountDoc, tradeDoc) {
  const accountId = accountDoc._id.toString();
  const tradeId = tradeDoc._id.toString();

  // 1. Initialize Account Risk Data if not present
  if (!accountRiskMap.has(accountId)) {
    // Fetch the initial/highest equity from the database on startup/initial trade.
    const maxDrawdownThreshold =
      accountDoc.initialBalance - accountDoc.initialBalance * 0.07;

    accountRiskMap.set(accountId, {
      initialBalance: accountDoc.initialBalance,
      dailyDrawdownLimit: accountDoc.dailyDrawdownLimit, // 2.5% [cite: 4]
      maxDrawdownLimit: accountDoc.maxDrawdownLimit, // 7% [cite: 5]
      currentBalance: accountDoc.balance, // updated when trade closes
      currentEquity: accountDoc.equity, // updated continuously
      currentDailyLoss: 0,
      highestEquity: accountDoc.equity,
      maxDrawdownThreshold,
      openPositionsPnl: new Map(),
      symbolsInUse: new Set(),
    });
  }

  const riskData = accountRiskMap.get(accountId);
  riskData.symbolsInUse.add(tradeDoc.symbol);

  // 2. Add Trade to Open Trades Map
  // NOTE: Daily and Max Trailing Drawdown are calculated at the ACCOUNT level (Equity),
  // but the trade entry is useful for PnL calculation.

  openTradesMap.set(tradeId, {
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

  // 3. For an *actual* market/liquidity check, subscribe to the symbol via Polygon.
  // This part will be handled in the calling function in the trade service.

  console.log(
    `[TradeMonitor] Trade ${tradeId} added for real-time monitoring.`
  );
}

/**
 * Removes a trade from monitoring when closed or failed.
 * @param {string} tradeId
 * @param {string} accountId
 */
function removeTradeFromMonitoring(tradeId, accountId) {
  const trade = openTradesMap.get(tradeId);
  if (!trade) return;

  openTradesMap.delete(tradeId);

  const riskData = accountRiskMap.get(accountId);
  if (riskData) {
    riskData.openPositionsPnl.delete(tradeId);
    // Check if other open trades use this symbol before removing it from symbolsInUse
    const symbolStillInUse = Array.from(openTradesMap.values()).some(
      (t) => t.symbol === trade.symbol && t.accountId === accountId
    );
    if (!symbolStillInUse) {
      riskData.symbolsInUse.delete(trade.symbol);
    }
  }

  console.log(`[TradeMonitor] Trade ${tradeId} removed from monitoring.`);
}

/**
 * Core function to check account-level rules on every price tick.
 * @param {string} accountId
 * @param {number} newEquity
 * @returns {string|null} The violation rule key if failed, otherwise null.
 */
function checkAccountRules(accountId, newEquity) {
  const riskData = accountRiskMap.get(accountId);
  if (!riskData) return null;

  let violation = null;

  // Max Drawdown (Trailing 7%)
  if (newEquity < riskData.maxDrawdownThreshold) {
    violation = "maxDrawdown";
  }

  // Daily Loss (2.5%)
  const dailyLoss = riskData.initialBalance - newEquity;
  if (dailyLoss > riskData.dailyDrawdownLimit) {
    violation = violation || "dailyDrawdown";
  }

  return violation;
}

/**
 * Processes a new price tick from Polygon.
 * @param {object} priceData - { symbol, price }
 */
async function processPriceUpdate(priceData) {
  const { symbol, price } = priceData;
  console.log(`\n[TradeMonitor] >>> Processing tick for ${symbol} at ${price}`);

  try {
    // Get all open trades for this symbol
    const trades = Array.from(openTradesMap.values()).filter(
      (t) => t.symbol === symbol
    );

    if (!trades.length) {
      console.log(`[TradeMonitor] No open trades for ${symbol}.`);
      return;
    }

    // Track which accounts are impacted by this price
    const affectedAccounts = new Map(); // accountId -> { trades: [], hasSlTpHit: boolean }

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

      // --- Check SL/TP ---
      if (side === "buy") {
        if (price <= stopLoss) hitSL = true;
        if (price >= takeProfit) hitTP = true;
      } else {
        if (price >= stopLoss) hitSL = true;
        if (price <= takeProfit) hitTP = true;
      }

      // --- Update unrealized PnL in-memory (whether SL/TP hit or not) ---
      const direction = side === "buy" ? 1 : -1;
      const symbolAmount = tradeSize / entryPrice;
      const pnl = (price - entryPrice) * symbolAmount * direction;

      const riskData = accountRiskMap.get(accountId);
      if (riskData) {
        riskData.openPositionsPnl.set(tradeId, pnl);
      }

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

    // --- Check drawdown rules for ALL affected accounts BEFORE closing any trades ---
    const accountsToLiquidate = new Set();

    for (const [accountId, accountData] of affectedAccounts) {
      const riskData = accountRiskMap.get(accountId);
      if (!riskData) continue;

      const totalOpenPnl = getTotalOpenPnl(accountId);

      // Compute in-memory equity (including the PnL from trades that hit SL/TP)
      const newEquity =
        (riskData.currentBalance || riskData.initialBalance) + totalOpenPnl;
      console.log("New Equity for Account", accountId, "is", newEquity);

      // Store this in-memory for next tick
      riskData.currentEquity = newEquity;

      // Check rules
      const violation = checkAccountRules(accountId, newEquity);

      if (violation) {
        console.warn(
          `[TradeMonitor] Account ${accountId} violated ${violation} rule. Marking for liquidation.`
        );
        accountsToLiquidate.add(accountId);
        affectedAccounts.get(accountId).violation = violation;
      }
    }

    // --- Handle liquidations FIRST (closes all trades including the one that hit SL/TP) ---
    for (const accountId of accountsToLiquidate) {
      const accountData = affectedAccounts.get(accountId);
      await handleAccountLiquidation(
        accountId,
        accountData.violation,
        accountRiskMap.get(accountId).currentEquity,
        priceData
      );
    }

    // --- Only close individual SL/TP trades if account was NOT liquidated ---
    for (const [accountId, accountData] of affectedAccounts) {
      // Skip if account was liquidated (all trades already closed)
      if (accountsToLiquidate.has(accountId)) {
        continue;
      }

      // Close individual trades that hit SL/TP
      for (const { trade, hitSL, hitTP } of accountData.trades) {
        if (hitSL || hitTP) {
          const reason = hitSL ? "stopLoss" : "takeProfit";
          console.log(
            `[TradeMonitor] Trade ${trade._id} hit ${reason}. Closing...`
          );

          await closeTrade(trade, price, reason);
          removeTradeFromMonitoring(trade._id, accountId);
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
  account.equity = account.balance; // assuming no open PnL now

  // ✅ Proper array manipulation
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

/**
 * Handles the critical action of failing an account due to a rule violation.
 * @param {string} accountId
 * @param {string} violationRule
 * @param {number} finalEquity
 * @param {object} priceData - The price that caused the breach
 */
async function handleAccountLiquidation(
  accountId,
  violationRule,
  finalEquity,
  priceData
) {
  console.warn(
    `[LIQUIDATION] Account ${accountId} failed due to ${violationRule}.`
  );

  // 1. Update the Account status to 'failed'
  await Account.findByIdAndUpdate(accountId, {
    status: "failed",
    equity: finalEquity,
    $push: {
      // Optional: log the violation to the account
    },
  });

  // 2. Close ALL open positions at the current price (including ones that just hit SL/TP)
  const tradesToClose = Array.from(openTradesMap.values()).filter(
    (t) => t.accountId === accountId
  );

  console.log(
    `[LIQUIDATION] Closing ${tradesToClose.length} trades for account ${accountId}`
  );

  // Close all trades using the closeTrade function for consistency
  for (const trade of tradesToClose) {
    const currentPrice = priceData.price;

    // Close the trade with the violation reason
    await closeTrade(trade, currentPrice, violationRule);

    // Remove from the in-memory map
    removeTradeFromMonitoring(trade._id, accountId);
  }

  // 3. Remove the account from the risk map (no longer active)
  accountRiskMap.delete(accountId);

  // 4. Log and notify user
  // (Implementation of a notification service would go here)
}

module.exports = {
  openTradesMap, // For external inspection/debugging
  accountRiskMap,
  addTradeForMonitoring,
  removeTradeFromMonitoring,
  processPriceUpdate,
};
