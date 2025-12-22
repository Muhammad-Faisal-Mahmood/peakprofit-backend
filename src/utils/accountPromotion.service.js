const Account = require("../trade/account/account.model");
const User = require("../user/user.model");
const createAccount = require("./createAccount");
const accountLiquidatorWrapper = require("./accountLiquidatorWrapper");

/**
 * Promotes a demo account to live after passing challenge requirements
 * @param {String} accountId - The account ID to promote
 * @returns {Object} Promotion result with status and message
 */
async function promoteAccountToLive(accountId, promotionReason) {
  try {
    console.log(
      `[AccountPromotion] 🎉 Starting promotion process for account ${accountId}`
    );

    const account = await Account.findById(accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    account.promotionReason = promotionReason;
    await account.save();

    console.log(`[AccountPromotion] Set promotion reason: ${promotionReason}`);

    // ✅ Step 1: Call liquidation function to close all trades and cancel pending orders
    await accountLiquidatorWrapper(
      accountId,
      "accountPromoted",
      null,
      null // No specific price data for promotion
    );

    console.log(
      `[AccountPromotion] All trades closed and pending orders cancelled`
    );

    // ✅ Step 2: Create new live account
    const newLiveAccount = await createAccount({
      userId: account.userId,
      challengeId: account.challengeId || null,
      accountSize: account.challengeId ? undefined : account.initialBalance,
      accountType: "live",
    });

    console.log(
      `[AccountPromotion] Created new live account: ${newLiveAccount._id}`
    );

    // ✅ Step 3: Link the demo and live accounts
    // Update the new live account with the demo account reference
    newLiveAccount.demoAccountId = accountId;
    await newLiveAccount.save();

    // Update the demo account with the live account reference
    account.liveAccountId = newLiveAccount._id;
    account.status = "closed";
    await account.save();

    console.log(
      `[AccountPromotion] Linked demo account ${accountId} with live account ${newLiveAccount._id}`
    );

    console.log(
      `[AccountPromotion] ✅ Account ${accountId} successfully promoted to LIVE. New live account created: ${newLiveAccount._id}`
    );

    await User.findByIdAndUpdate(
      account.userId,
      { $pull: { accounts: accountId } },
      { new: true }
    );

    console.log(
      "[AccountPromotion] Removed demo account from user's account list"
    );
    return {
      success: true,
      promoted: true,
      message: "Account promoted to live.",
      accountId: newLiveAccount._id,
      newBalance: newLiveAccount.initialBalance,
      accountType: "live",
      status: "active",
    };
  } catch (error) {
    console.error(
      ` [AccountPromotion] Error promoting account ${accountId}:`,
      error
    );
    throw error;
  }
}

/**
 * Checks if account meets all requirements for promotion
 * @param {Object} account - The account document
 * @returns {Boolean} True if account should be promoted
 */
function shouldPromoteAccount(account) {
  const targetBalance = account.initialBalance + account.profitTarget;
  const hasMetTradingDays =
    account.activelyTradedDays >= account.minTradingDays;
  const hasMetProfitTarget = account.balance >= targetBalance;
  const isDemoAccount = account.accountType === "demo";

  const shouldPromote =
    isDemoAccount && hasMetTradingDays && hasMetProfitTarget;

  if (shouldPromote) {
    console.log(
      `     [AccountPromotion] Account ${account._id} meets promotion criteria:`,
      {
        tradingDays: account.activelyTradedDays,
        requiredDays: account.minTradingDays,
        currentBalance: account.balance,
        targetBalance,
        accountType: account.accountType,
      }
    );
  }

  return shouldPromote;
}

module.exports = {
  promoteAccountToLive,
  shouldPromoteAccount,
};
