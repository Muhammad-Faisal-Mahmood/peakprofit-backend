const client = require("../config/redis.config");

/**
 * Redis key prefixes for organized data storage
 */
const KEYS = {
  OPEN_TRADE: (tradeId) => `trade:open:${tradeId}`,
  ACCOUNT_RISK: (accountId) => `account:risk:${accountId}`,
  ACCOUNT_OPEN_PNL: (accountId) => `account:pnl:${accountId}`,
  ACCOUNT_SYMBOLS: (accountId) => `account:symbols:${accountId}`,
};

/**
 * Store an open trade in Redis
 * @param {string} tradeId
 * @param {object} tradeData
 */
async function setOpenTrade(tradeId, tradeData) {
  const key = KEYS.OPEN_TRADE(tradeId);
  await client.set(key, JSON.stringify(tradeData));
  console.log(`[Redis] Stored open trade: ${tradeId}`);
}

/**
 * Get an open trade from Redis
 * @param {string} tradeId
 * @returns {object|null}
 */
async function getOpenTrade(tradeId) {
  const key = KEYS.OPEN_TRADE(tradeId);
  const data = await client.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Delete an open trade from Redis
 * @param {string} tradeId
 */
async function deleteOpenTrade(tradeId) {
  const key = KEYS.OPEN_TRADE(tradeId);
  await client.del(key);
  console.log(`[Redis] Deleted open trade: ${tradeId}`);
}

/**
 * Get all open trades for a specific symbol
 * @param {string} symbol
 * @returns {Array}
 */
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

/**
 * Get all open trades for a specific account
 * @param {string} accountId
 * @returns {Array}
 */
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

/**
 * Store account risk data in Redis
 * @param {string} accountId
 * @param {object} riskData
 */
async function setAccountRisk(accountId, riskData) {
  const key = KEYS.ACCOUNT_RISK(accountId);
  await client.set(key, JSON.stringify(riskData));
  console.log(`[Redis] Stored account risk data: ${accountId}`);
}

/**
 * Get account risk data from Redis
 * @param {string} accountId
 * @returns {object|null}
 */
async function getAccountRisk(accountId) {
  const key = KEYS.ACCOUNT_RISK(accountId);
  const data = await client.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Delete account risk data from Redis
 * @param {string} accountId
 */
async function deleteAccountRisk(accountId) {
  const key = KEYS.ACCOUNT_RISK(accountId);
  await client.del(key);
  console.log(`[Redis] Deleted account risk data: ${accountId}`);
}

/**
 * Store unrealized PnL for a specific trade
 * @param {string} accountId
 * @param {string} tradeId
 * @param {number} pnl
 */
async function setTradePnL(accountId, tradeId, pnl) {
  const key = KEYS.ACCOUNT_OPEN_PNL(accountId);
  await client.hSet(key, tradeId, pnl.toString());
}

/**
 * Get unrealized PnL for a specific trade
 * @param {string} accountId
 * @param {string} tradeId
 * @returns {number}
 */
async function getTradePnL(accountId, tradeId) {
  const key = KEYS.ACCOUNT_OPEN_PNL(accountId);
  const pnl = await client.hGet(key, tradeId);
  return pnl ? parseFloat(pnl) : 0;
}

/**
 * Get all unrealized PnLs for an account
 * @param {string} accountId
 * @returns {object} - Map of tradeId -> pnl
 */
async function getAllTradePnLs(accountId) {
  const key = KEYS.ACCOUNT_OPEN_PNL(accountId);
  const pnls = await client.hGetAll(key);

  const result = {};
  for (const [tradeId, pnl] of Object.entries(pnls)) {
    result[tradeId] = parseFloat(pnl);
  }

  return result;
}

/**
 * Delete PnL entry for a specific trade
 * @param {string} accountId
 * @param {string} tradeId
 */
async function deleteTradePnL(accountId, tradeId) {
  const key = KEYS.ACCOUNT_OPEN_PNL(accountId);
  await client.hDel(key, tradeId);
}

/**
 * Delete all PnL entries for an account
 * @param {string} accountId
 */
async function deleteAllTradePnLs(accountId) {
  const key = KEYS.ACCOUNT_OPEN_PNL(accountId);
  await client.del(key);
}

/**
 * Add a symbol to account's active symbols set
 * @param {string} accountId
 * @param {string} symbol
 */
async function addAccountSymbol(accountId, symbol) {
  const key = KEYS.ACCOUNT_SYMBOLS(accountId);
  await client.sAdd(key, symbol);
}

/**
 * Remove a symbol from account's active symbols set
 * @param {string} accountId
 * @param {string} symbol
 */
async function removeAccountSymbol(accountId, symbol) {
  const key = KEYS.ACCOUNT_SYMBOLS(accountId);
  await client.sRem(key, symbol);
}

/**
 * Get all symbols in use by an account
 * @param {string} accountId
 * @returns {Array<string>}
 */
async function getAccountSymbols(accountId) {
  const key = KEYS.ACCOUNT_SYMBOLS(accountId);
  return await client.sMembers(key);
}

/**
 * Check if a symbol is in use by an account
 * @param {string} accountId
 * @param {string} symbol
 * @returns {boolean}
 */
async function isSymbolInUse(accountId, symbol) {
  const key = KEYS.ACCOUNT_SYMBOLS(accountId);
  return await client.sIsMember(key, symbol);
}

/**
 * Delete all symbols for an account
 * @param {string} accountId
 */
async function deleteAccountSymbols(accountId) {
  const key = KEYS.ACCOUNT_SYMBOLS(accountId);
  await client.del(key);
}

/**
 * Calculate total unrealized PnL for an account
 * @param {string} accountId
 * @returns {number}
 */
async function getTotalOpenPnl(accountId) {
  const pnls = await getAllTradePnLs(accountId);
  return Object.values(pnls).reduce((sum, pnl) => sum + pnl, 0);
}

/**
 * Update account risk data fields
 * @param {string} accountId
 * @param {object} updates - Partial risk data to update
 */
async function updateAccountRisk(accountId, updates) {
  const currentData = await getAccountRisk(accountId);
  if (!currentData) {
    throw new Error(`Account risk data not found for ${accountId}`);
  }

  const updatedData = { ...currentData, ...updates };
  await setAccountRisk(accountId, updatedData);
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
};
