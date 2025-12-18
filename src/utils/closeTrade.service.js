const Account = require("../trade/account/account.model");
const Trade = require("../trade/trade.model");
const redis = require("./redis.helper");
const {
  promoteAccountToLive,
  shouldPromoteAccount,
} = require("./accountPromotion.service");

async function closeTradeService(trade, currentPrice, reason) {
  const { side, entryPrice, tradeSize, leverage = 50, _id, accountId } = trade;

  // 🔒 CRITICAL: Check if trade is already closed (idempotency check)
  const existingTrade = await Trade.findById(_id);

  if (!existingTrade) {
    console.warn(`[closeTrade] Trade ${_id} not found in database. Skipping.`);
    return null;
  }

  if (existingTrade.status === "closed") {
    console.warn(
      `    [closeTrade] Trade ${_id} already closed at ${existingTrade.exitPrice}. Skipping duplicate close.`
    );
    return existingTrade;
  }

  // Additional safety: Check if still in open positions
  const account = await Account.findById(accountId);
  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }

  const isInOpenPositions = account.openPositions.some(
    (posId) => posId.toString() === _id.toString()
  );

  if (!isInOpenPositions) {
    console.warn(
      `  [closeTrade] Trade ${_id} not in account's open positions. Already processed. Skipping.`
    );
    return existingTrade;
  }

  // ✅ Safe to proceed with closure

  const direction = side === "buy" ? 1 : -1;
  const symbolAmount = tradeSize / entryPrice;
  const pnl = (currentPrice - entryPrice) * symbolAmount * direction;
  const pnlPercent = (pnl / account.balance) * 100;

  const marginToRelease = (tradeSize * entryPrice) / leverage;
  account.marginUsed = Math.max(0, account.marginUsed - marginToRelease);
  account.balance += pnl;
  account.equity = account.balance;

  account.openPositions = account.openPositions.filter(
    (posId) => posId.toString() !== _id.toString()
  );
  account.closedPositions.push(_id);
  await updateDailyProfit(account);
  if (account.accountType == "demo") {
    let dailyProfitTarget =
      account.currentDayEquity + account.profitTarget / account.minTradingDays;
    if (account.balance >= dailyProfitTarget) {
      account.profitTarget += account.balance - dailyProfitTarget;
    }
  }
  if (account.accountType === "live") {
    const { qualifiedDays } = account.hasConsistentProfitDays();
    account.activelyTradedDays = qualifiedDays;
  }

  await account.save();

  // Update the trade document
  const updateData = {
    status: "closed",
    exitPrice: currentPrice,
    closedAt: new Date(),
    pnl: pnl,
    pnlPercent: pnlPercent,
    tradeClosureReason: reason,
  };

  const updatedTrade = await Trade.findByIdAndUpdate(_id, updateData, {
    new: true,
  });

  console.log(
    `[closeTrade] Trade ${_id} closed at ${currentPrice}. Reason: ${reason}, PnL: ${pnl.toFixed(
      2
    )}`
  );

  // ✅ Check if account should be promoted (AFTER saving everything)
  const freshAccount = await Account.findById(accountId); // Get fresh account data
  if (shouldPromoteAccount(freshAccount)) {
    console.log(
      ` [closeTrade] Account ${accountId} qualifies for promotion. Initiating promotion process...`
    );

    const promotionResult = await promoteAccountToLive(accountId.toString());

    // Return promotion result instead of trade
    return {
      ...promotionResult,
      closedTrade: updatedTrade, // Include the closed trade info
    };
  }

  // Normal flow: Update Redis with new balance/equity
  const riskData = await redis.getAccountRisk(accountId.toString());
  if (riskData) {
    await redis.updateAccountRisk(accountId.toString(), {
      currentBalance: account.balance,
      currentEquity: account.equity,
    });
    console.log(
      `  [closeTrade] Updated Redis balance for account ${accountId}: ${account.balance}`
    );
  }

  return updatedTrade;
}

async function updateDailyProfit(account) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD

  // Check if we already have an entry for today
  const todayEntry = account.dailyProfits.find(
    (entry) => entry.date.toISOString().slice(0, 10) === today
  );

  // Update existing entry
  if (todayEntry) {
    todayEntry.endingBalance = account.balance;
    todayEntry.profitAmount = account.balance - todayEntry.startingBalance;
    todayEntry.profitPercentage =
      (todayEntry.profitAmount / todayEntry.startingBalance) * 100;
    todayEntry.meetsMinimum = todayEntry.profitPercentage >= 0.5;

    console.log(
      `[updateDailyProfit] Updated day ${today}: ${todayEntry.profitPercentage.toFixed(
        2
      )}% profit (meets 0.5% minimum: ${todayEntry.meetsMinimum})`
    );
  }
}

module.exports = closeTradeService;
