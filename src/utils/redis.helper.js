const client = require("../config/redis.config");

/**
 * Redis key prefixes for organized data storage
 */
const KEYS = {
  OPEN_TRADE: (tradeId) => `trade:open:${tradeId}`,
  ACCOUNT_RISK: (accountId) => `account:risk:${accountId}`,
  ACCOUNT_OPEN_PNL: (accountId) => `account:pnl:${accountId}`,
  ACCOUNT_SYMBOLS: (accountId) => `account:symbols:${accountId}`,
  PENDING_ORDER: (orderId) => `order:pending:${orderId}`,
  ACCOUNT_PENDING_ORDERS: (accountId) => `account:pending:${accountId}`,
  SYMBOL_PENDING_ORDERS: (symbol) => `symbol:pending:${symbol}`,
};

async function setOpenTrade(tradeId, tradeData) {
  const key = KEYS.OPEN_TRADE(tradeId);
  await client.set(key, JSON.stringify(tradeData));
  console.log(`[Redis] Stored open trade: ${tradeId}`);
}

async function getOpenTrade(tradeId) {
  const key = KEYS.OPEN_TRADE(tradeId);
  const data = await client.get(key);
  return data ? JSON.parse(data) : null;
}

async function deleteOpenTrade(tradeId) {
  const key = KEYS.OPEN_TRADE(tradeId);
  await client.del(key);
  console.log(`[Redis] Deleted open trade: ${tradeId}`);
}

async function getOpenTradesBySymbol(symbol) {
  const keys = await client.keys("trade:open:*");
  const trades = [];

  for (const key of keys) {
    const data = await client.get(key);
    if (data) {
      const trade = JSON.parse(data);
      if (trade.symbol === symbol) {
        trades.push(trade);
      }
    }
  }

  return trades;
}

async function getOpenTradesByAccount(accountId) {
  const keys = await client.keys("trade:open:*");
  const trades = [];

  for (const key of keys) {
    const data = await client.get(key);
    if (data) {
      const trade = JSON.parse(data);
      if (trade.accountId === accountId) {
        trades.push(trade);
      }
    }
  }

  return trades;
}

async function setAccountRisk(accountId, riskData) {
  const key = KEYS.ACCOUNT_RISK(accountId);
  await client.set(key, JSON.stringify(riskData));
  // console.log(`[Redis] Stored account risk data: ${accountId}`);
}

async function getAccountRisk(accountId) {
  const key = KEYS.ACCOUNT_RISK(accountId);
  const data = await client.get(key);
  return data ? JSON.parse(data) : null;
}

async function deleteAccountRisk(accountId) {
  const key = KEYS.ACCOUNT_RISK(accountId);
  await client.del(key);
  console.log(`[Redis] Deleted account risk data: ${accountId}`);
}

async function setTradePnL(accountId, tradeId, pnl) {
  const key = KEYS.ACCOUNT_OPEN_PNL(accountId);
  await client.hSet(key, tradeId, pnl.toString());
}

async function getTradePnL(accountId, tradeId) {
  const key = KEYS.ACCOUNT_OPEN_PNL(accountId);
  const pnl = await client.hGet(key, tradeId);
  return pnl ? parseFloat(pnl) : 0;
}

async function getAllTradePnLs(accountId) {
  const key = KEYS.ACCOUNT_OPEN_PNL(accountId);
  const pnls = await client.hGetAll(key);

  const result = {};
  for (const [tradeId, pnl] of Object.entries(pnls)) {
    result[tradeId] = parseFloat(pnl);
  }

  return result;
}

async function deleteTradePnL(accountId, tradeId) {
  const key = KEYS.ACCOUNT_OPEN_PNL(accountId);
  await client.hDel(key, tradeId);
}

async function deleteAllTradePnLs(accountId) {
  const key = KEYS.ACCOUNT_OPEN_PNL(accountId);
  await client.del(key);
}

async function addAccountSymbol(accountId, symbol) {
  const key = KEYS.ACCOUNT_SYMBOLS(accountId);
  await client.sAdd(key, symbol);
}

async function removeAccountSymbol(accountId, symbol) {
  const key = KEYS.ACCOUNT_SYMBOLS(accountId);
  await client.sRem(key, symbol);
}

async function getAccountSymbols(accountId) {
  const key = KEYS.ACCOUNT_SYMBOLS(accountId);
  return await client.sMembers(key);
}

async function isSymbolInUse(accountId, symbol) {
  const key = KEYS.ACCOUNT_SYMBOLS(accountId);
  return await client.sIsMember(key, symbol);
}

async function deleteAccountSymbols(accountId) {
  const key = KEYS.ACCOUNT_SYMBOLS(accountId);
  await client.del(key);
}

async function getTotalOpenPnl(accountId) {
  const pnls = await getAllTradePnLs(accountId);
  return Object.values(pnls).reduce((sum, pnl) => sum + pnl, 0);
}

async function updateAccountRisk(accountId, updates) {
  const currentData = await getAccountRisk(accountId);
  if (!currentData) {
    throw new Error(`Account risk data not found for ${accountId}`);
  }

  const updatedData = { ...currentData, ...updates };
  await setAccountRisk(accountId, updatedData);
}

// In redis.helper.js

async function setPendingOrder(orderId, orderData) {
  const key = KEYS.PENDING_ORDER(orderId);
  await client.set(key, JSON.stringify(orderData));

  // Also add to account's pending orders set
  const accountKey = KEYS.ACCOUNT_PENDING_ORDERS(orderData.accountId);
  await client.sAdd(accountKey, orderId);

  // Add to symbol's pending orders set
  const symbolKey = KEYS.SYMBOL_PENDING_ORDERS(orderData.symbol);
  await client.sAdd(symbolKey, orderId);

  console.log(`[Redis] Stored pending order: ${orderId}`);
}

async function getPendingOrder(orderId) {
  const key = KEYS.PENDING_ORDER(orderId);
  const data = await client.get(key);
  return data ? JSON.parse(data) : null;
}

async function deletePendingOrder(orderId, accountId, symbol) {
  const key = KEYS.PENDING_ORDER(orderId);
  await client.del(key);

  // Remove from account's pending orders
  const accountKey = KEYS.ACCOUNT_PENDING_ORDERS(accountId);
  await client.sRem(accountKey, orderId);

  // Remove from symbol's pending orders
  const symbolKey = KEYS.SYMBOL_PENDING_ORDERS(symbol);
  await client.sRem(symbolKey, orderId);

  console.log(`[Redis] Deleted pending order: ${orderId}`);
}

async function getPendingOrdersBySymbol(symbol) {
  const symbolKey = KEYS.SYMBOL_PENDING_ORDERS(symbol);
  const orderIds = await client.sMembers(symbolKey);

  const orders = [];
  for (const orderId of orderIds) {
    const order = await getPendingOrder(orderId);
    if (order) orders.push(order);
  }

  return orders;
}

async function getPendingOrdersByAccount(accountId) {
  const accountKey = KEYS.ACCOUNT_PENDING_ORDERS(accountId);
  const orderIds = await client.sMembers(accountKey);

  const orders = [];
  for (const orderId of orderIds) {
    const order = await getPendingOrder(orderId);
    if (order) orders.push(order);
  }

  return orders;
}

async function clearAll() {
  try {
    await client.flushDb();
    console.log("[Redis] All keys cleared from DB");
  } catch (error) {
    console.error("[Redis] Failed to clear DB:", error);
  }
}

module.exports = {
  // Trade operations
  setOpenTrade,
  getOpenTrade,
  deleteOpenTrade,
  getOpenTradesBySymbol,
  getOpenTradesByAccount,

  // Account risk operations
  setAccountRisk,
  getAccountRisk,
  deleteAccountRisk,
  updateAccountRisk,

  // PnL operations
  setTradePnL,
  getTradePnL,
  getAllTradePnLs,
  deleteTradePnL,
  deleteAllTradePnLs,
  getTotalOpenPnl,

  // Symbol tracking operations
  addAccountSymbol,
  removeAccountSymbol,
  getAccountSymbols,
  isSymbolInUse,
  deleteAccountSymbols,

  // Pending order operations
  setPendingOrder,
  getPendingOrder,
  deletePendingOrder,
  getPendingOrdersBySymbol,
  getPendingOrdersByAccount,

  //flush db
  clearAll,
};
