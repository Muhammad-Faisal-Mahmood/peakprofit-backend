const Account = require("../trade/account/account.model");
const Trade = require("../trade/trade.model");

async function closeTradeService(trade, currentPrice, reason) {
  const { side, entryPrice, tradeSize, leverage = 50, _id, accountId } = trade;

  const direction = side === "buy" ? 1 : -1;
  const symbolAmount = tradeSize / entryPrice;
  const pnl = (currentPrice - entryPrice) * symbolAmount * direction;

  const account = await Account.findById(accountId);
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

  console.log(
    `[closeTrade] Trade ${_id} closed at ${currentPrice}. Reason: ${reason}, PnL: ${pnl.toFixed(
      2
    )}`
  );

  return await Trade.findByIdAndUpdate(_id, updateData, { new: true });
}

module.exports = closeTradeService;
