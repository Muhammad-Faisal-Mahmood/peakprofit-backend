const Account = require("../trade/account/account.model");
const Trade = require("../trade/trade.model");
const redis = require("./redis.helper");

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
      `[closeTrade] Trade ${_id} already closed at ${existingTrade.exitPrice}. Skipping duplicate close.`
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
      `[closeTrade] Trade ${_id} not in account's open positions. Already processed. Skipping.`
    );
    return existingTrade;
  }

  // ✅ Safe to proceed with closure

  const direction = side === "buy" ? 1 : -1;
  const symbolAmount = tradeSize / entryPrice;
  const pnl = (currentPrice - entryPrice) * symbolAmount * direction;

  if (!account) throw new Error("Account not found");

  const marginToRelease = (tradeSize * entryPrice) / leverage;
  account.marginUsed = Math.max(0, account.marginUsed - marginToRelease);
  account.balance += pnl;
  account.equity = account.balance;

  account.openPositions = account.openPositions.filter(
    (posId) => posId.toString() !== _id.toString()
  );
  account.closedPositions.push(_id);

  await account.save();

  const updateData = {
    status: "closed",
    exitPrice: currentPrice,
    closedAt: new Date(),
    profit: pnl,
    tradeClosureReason: reason,
  };

  const riskData = await redis.getAccountRisk(accountId.toString());
  if (riskData) {
    await redis.updateAccountRisk(accountId.toString(), {
      currentBalance: account.balance,
      currentEquity: account.equity,
    });
    console.log(
      `[closeTrade] Updated Redis balance for account ${accountId}: ${account.balance}`
    );
  }

  console.log(
    `[closeTrade] Trade ${_id} closed at ${currentPrice}. Reason: ${reason}, PnL: ${pnl.toFixed(
      2
    )}`
  );

  return await Trade.findByIdAndUpdate(_id, updateData, { new: true });
}

module.exports = closeTradeService;
