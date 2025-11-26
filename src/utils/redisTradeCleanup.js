const redis = require("./redis.helper");

async function redisTradeCleanup({ tradeId, accountId, symbol, market }) {
  const { triggerUnsubscribeCheck } = require("../trade/tradeMonitor.service");
  // 1. Check if trade exists
  const redisTrade = await redis.getOpenTrade(tradeId);
  if (!redisTrade) {
    console.warn(
      `[cleanupClosedTrade] Trade ${tradeId} not found in Redis (already removed).`
    );
    return;
  }

  // 2. Remove from open trades
  await redis.deleteOpenTrade(tradeId);

  // 3. Remove PnL tracking
  await redis.deleteTradePnL(accountId.toString(), tradeId.toString());

  // 4. Check if any other trades still use this symbol
  const remainingTrades = await redis.getOpenTradesByAccount(accountId);
  const stillUsed = remainingTrades.some(
    (t) => t.symbol === symbol && t._id !== tradeId
  );

  // 5. If symbol not used, remove it
  if (!stillUsed) {
    await redis.removeAccountSymbol(accountId, symbol);
  }

  // 6. Trigger unsubscribe if needed (non-blocking)
  if (market && symbol) {
    triggerUnsubscribeCheck(market, symbol).catch(console.error);
  }

  console.log(
    `[cleanupClosedTrade] Trade ${tradeId} removed from Redis successfully.`
  );
}

module.exports = redisTradeCleanup;
