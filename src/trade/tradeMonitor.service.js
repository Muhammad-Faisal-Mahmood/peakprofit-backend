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

// Assumed Constant (You need to define this based on your markets)
const CONTRACT_MULTIPLIER = 1; // e.g., 1 for crypto, 100000 for standard forex lot

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
      dailyDrawdownLimit: accountDoc.initialBalance * 0.025, // 2.5% [cite: 4]
      maxDrawdownLimit: accountDoc.initialBalance * 0.07, // 7% [cite: 5]
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
    accountId: accountId,
    userId: tradeDoc.userId.toString(),
    symbol: tradeDoc.symbol,
    side: tradeDoc.side,
    volume: tradeDoc.volume,
    entryPrice: tradeDoc.entryPrice,
    market: tradeDoc.market,
    contractMultiplier: CONTRACT_MULTIPLIER, // Placeholder
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

  // --- 1. Max Trailing Drawdown Check (7%) ---
  // Rule: Max Total Drawdown may not exceed 7% maximum trailing drawdown[cite: 5].
  if (newEquity < riskData.maxDrawdownThreshold) {
    violation = "maxDrawdown";
    console.error(
      `[VIOLATION] Account ${accountId} failed Max Drawdown. Equity: ${newEquity.toFixed(
        2
      )} < Threshold: ${riskData.maxDrawdownThreshold.toFixed(2)}`
    );
  }

  // --- 2. Daily Loss Limit Check (2.5%) ---
  // Rule: Daily Loss Limit is 2.5% of starting account balance[cite: 4].
  // NOTE: This check should include REALIZED Daily Loss + Current Unrealized Loss
  const currentDrawdownFromStartOfDay = riskData.initialBalance - newEquity; // Simplified assumption for daily check
  const maxDailyLossAllowed = riskData.dailyDrawdownLimit;

  if (currentDrawdownFromStartOfDay > maxDailyLossAllowed) {
    // This is a simplified check. A true daily check compares against (Previous Day's Close Balance or Initial Balance).
    // For simplicity, we compare to the Initial Balance for now.
    violation = violation || "dailyDrawdown";
    console.error(
      `[VIOLATION] Account ${accountId} failed Daily Loss Limit. Daily Drawdown: ${currentDrawdownFromStartOfDay.toFixed(
        2
      )} > Limit: ${maxDailyLossAllowed.toFixed(2)}`
    );
  }

  // --- 3. Update Highest Equity (For Trailing Drawdown) ---
  // Max Drawdown Trailing logic: if new equity is higher, update the high water mark.
  if (newEquity > riskData.highestEquity) {
    riskData.highestEquity = newEquity;
    // Recalculate the new max drawdown threshold
    riskData.maxDrawdownThreshold =
      riskData.highestEquity - riskData.maxDrawdownLimit;
    console.log(
      `[TradeMonitor] Account ${accountId} highest equity updated to ${newEquity.toFixed(
        2
      )}. New threshold: ${riskData.maxDrawdownThreshold.toFixed(2)}`
    );
  }

  return violation;
}

/**
 * Processes a new price tick from Polygon.
 * @param {object} priceData - { symbol, price }
 */
async function processPriceUpdate(priceData) {
  const { symbol, price } = priceData;
  console.log(`[TradeMonitor] Processing price update for ${symbol}: ${price}`);

  // 1. Find all open trades for this symbol
  const tradesToUpdate = Array.from(openTradesMap.values()).filter(
    (t) => t.symbol === symbol
  );

  console.log(
    `[TradeMonitor] Found ${tradesToUpdate.length} open trades for ${symbol}.`
  );

  if (tradesToUpdate.length === 0) return;

  const accountsToUpdate = new Set();

  //   2. Calculate PnL for each trade and accumulate by account
  for (const trade of tradesToUpdate) {
    const contractMultiplier = trade.contractMultiplier;
    let pnl;

    // PnL = (Current Price - Entry Price) * Volume * Multiplier * Direction (1 or -1)
    if (trade.side === "buy") {
      pnl = (price - trade.entryPrice) * trade.volume * contractMultiplier;
    } else {
      // 'sell'
      pnl = (trade.entryPrice - price) * trade.volume * contractMultiplier;
    }

    // Update the in-memory PnL for this specific trade
    const riskData = accountRiskMap.get(trade.accountId);
    if (riskData) {
      riskData.openPositionsPnl.set(trade._id, pnl);
      accountsToUpdate.add(trade.accountId);
    }
  }

  // 3. Check rules for affected accounts
  for (const accountId of accountsToUpdate) {
    const riskData = accountRiskMap.get(accountId);
    if (!riskData) continue;

    // Calculate new equity
    const totalOpenPnl = getTotalOpenPnl(accountId);
    // NOTE: We MUST fetch the current *realized balance* from the DB or keep it in memory.
    // For simplicity here, we assume a placeholder current realized balance.
    // In a real system, you would need to frequently sync the realized balance from the DB.
    const accountDoc = await Account.findById(accountId)
      .select("balance")
      .lean();
    if (!accountDoc) continue;

    const currentBalance = accountDoc.balance; // Realized Balance
    const newEquity = currentBalance + totalOpenPnl;

    // Perform the rule check
    const violation = checkAccountRules(accountId, newEquity);

    if (violation) {
      // Rule failed! Immediately liquidate the account and update the database.
      // This is a critical action that must be robust.
      await handleAccountLiquidation(
        accountId,
        violation,
        newEquity,
        priceData
      );
    } else {
      // Update the equity in the database for accurate dashboard reporting
      await Account.findByIdAndUpdate(accountId, { equity: newEquity });
    }
  }
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

  // 2. Close all open positions at the current price
  const tradesToClose = Array.from(openTradesMap.values()).filter(
    (t) => t.accountId === accountId
  );

  // In a real system, you would fire a service to execute market closes for these trades
  // For now, we simulate the closure and update the database.
  for (const trade of tradesToClose) {
    // Calculate realized PnL for closure
    const currentPrice = priceData.price;
    let realizedPnl;

    if (trade.side === "buy") {
      realizedPnl =
        (currentPrice - trade.entryPrice) *
        trade.volume *
        trade.contractMultiplier;
    } else {
      realizedPnl =
        (trade.entryPrice - currentPrice) *
        trade.volume *
        trade.contractMultiplier;
    }

    // Update Trade in DB
    await Trade.findByIdAndUpdate(trade._id, {
      status: "closed",
      exitPrice: currentPrice,
      closedAt: new Date(),
      profit: realizedPnl,
      $push: { violatedRules: violationRule },
    });

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
