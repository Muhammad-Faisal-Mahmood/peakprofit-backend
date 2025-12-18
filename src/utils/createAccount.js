//createAccount.js
const Account = require("../trade/account/account.model");
const Challenge = require("../challenge/challenge.model");
const User = require("../user/user.model");

async function createAccount({
  userId,
  challengeId,
  accountType = "demo",
  accountSize,
}) {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  // Determine initial balance
  let initialBalance;

  if (challengeId) {
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      throw new Error("Challenge not found.");
    }
    initialBalance = challenge.accountSize;
  } else if (accountSize) {
    initialBalance = accountSize;
  } else {
    throw new Error("Either challengeId or accountSize must be provided.");
  }

  // === PeakProfit Rules ===
  const leverage = 50;
  let dailyDrawdownLimit = initialBalance * 0.025; // 2.5%
  let maxDrawdownLimit = initialBalance * 0.07; // 7%
  const profitTarget = initialBalance * 0.08; // 8%
  const minTradingDays = 3; // Required to pass challenge

  if (accountType === "live") {
    // Live account drawdown rules
    dailyDrawdownLimit = initialBalance * 0.02;
    maxDrawdownLimit = initialBalance * 0.06;
  }

  // Create the account
  const newAccount = await Account.create({
    userId,
    challengeId: challengeId || null,
    accountType,
    initialBalance,
    balance: initialBalance,
    equity: initialBalance,
    marginUsed: 0,
    freeMargin: initialBalance,
    leverage,
    dailyDrawdownLimit,
    maxDrawdownLimit,
    profitTarget,
    minTradingDays,
    status: accountType == "demo" ? "active" : "passed",
    openPositions: [],
    closedPositions: [],
    currentDayEquity: initialBalance,
  });

  await User.findByIdAndUpdate(
    userId,
    { $push: { accounts: newAccount._id } },
    { new: true }
  );

  return newAccount;
}

module.exports = createAccount;
