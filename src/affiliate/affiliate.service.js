const Affiliate = require("./affiliate.model"); // Adjust path as needed
const User = require("../user/user.model"); // Adjust path as needed

// Tier upgrade thresholds and benefits
const TIER_CONFIG = {
  BRONZE: {
    minReferrals: 0,
    commissionPercentage: 5,
    nextTier: "SILVER",
  },
  SILVER: {
    minReferrals: 10,
    commissionPercentage: 10,
    nextTier: "GOLD",
  },
  GOLD: {
    minReferrals: 50,
    commissionPercentage: 15,
    nextTier: "PLATINUM",
  },
  PLATINUM: {
    minReferrals: 100, // You can set this threshold as needed
    commissionPercentage: 20,
    nextTier: null, // Highest tier
  },
};

async function findByReferralCode(referralCode) {
  return await Affiliate.findOne({ referralCode });
}

// Function to check and upgrade affiliate tier
async function checkAndUpgradeTier(affiliate) {
  const currentTier = affiliate.tier;
  const totalReferrals = affiliate.totalReferrals;

  let newTier = currentTier;
  let upgraded = false;

  // Check tier upgrades
  if (currentTier === "BRONZE" && totalReferrals >= 10) {
    newTier = "SILVER";
    upgraded = true;
  } else if (currentTier === "SILVER" && totalReferrals >= 50) {
    newTier = "GOLD";
    upgraded = true;
  }
  // else if (currentTier === "GOLD" && totalReferrals >= 100) {
  //   newTier = "PLATINUM";
  //   upgraded = true;
  // }

  if (upgraded) {
    // Update tier and commission percentage
    affiliate.tier = newTier;
    affiliate.commissionPercentage = TIER_CONFIG[newTier].commissionPercentage;

    await affiliate.save();

    console.log(
      `🎉 Affiliate ${affiliate.referralCode} upgraded to ${newTier} tier! New commission: ${affiliate.commissionPercentage}%`
    );

    return {
      upgraded: true,
      oldTier: currentTier,
      newTier: newTier,
      newCommissionPercentage: affiliate.commissionPercentage,
    };
  }

  return { upgraded: false };
}

// Function to recalculate commissions for existing referrals when tier upgrades
async function recalculateReferralCommissions(
  affiliate,
  oldCommissionPercentage
) {
  try {
    let totalRecalculatedEarnings = 0;
    let balanceAdjustment = 0;

    // Recalculate commissions for all existing purchases
    for (let referral of affiliate.referrals) {
      let referralEarningsAdjustment = 0;

      for (let purchase of referral.purchases) {
        const oldCommission = purchase.commissionEarned;
        const newCommission =
          (purchase.challengeCost * affiliate.commissionPercentage) / 100;
        const commissionDifference = newCommission - oldCommission;

        // Update the purchase record
        purchase.commissionEarned = newCommission;
        purchase.commissionPercentage = affiliate.commissionPercentage;

        referralEarningsAdjustment += commissionDifference;
        totalRecalculatedEarnings += commissionDifference;
      }

      // Update referral total earnings
      referral.totalEarnings += referralEarningsAdjustment;
    }

    // Update affiliate totals
    affiliate.totalEarnings += totalRecalculatedEarnings;
    affiliate.balance += totalRecalculatedEarnings;

    await affiliate.save();

    console.log(
      `📊 Recalculated commissions for affiliate ${
        affiliate.referralCode
      }: +$${totalRecalculatedEarnings.toFixed(2)}`
    );

    return {
      totalAdjustment: totalRecalculatedEarnings,
      newBalance: affiliate.balance,
      newTotalEarnings: affiliate.totalEarnings,
    };
  } catch (error) {
    console.error("Error recalculating referral commissions:", error);
    throw error;
  }
}

async function processReferralSignup(referralCode, newUserId) {
  if (!referralCode) return null;

  try {
    const affiliate = await findByReferralCode(referralCode);
    if (!affiliate) {
      console.log(`Invalid referral code: ${referralCode}`);
      return null;
    }

    const oldCommissionPercentage = affiliate.commissionPercentage;

    // Add referral record to affiliate
    await affiliate.addReferral(newUserId);

    // Check for tier upgrade after adding referral
    const upgradeResult = await checkAndUpgradeTier(affiliate);

    let result = {
      affiliateUserId: affiliate.userId,
      tierUpgrade: upgradeResult,
    };

    // If tier was upgraded, recalculate existing commissions
    if (upgradeResult.upgraded) {
      const recalculationResult = await recalculateReferralCommissions(
        affiliate,
        oldCommissionPercentage
      );
      result.commissionRecalculation = recalculationResult;
    }

    return result.affiliateUserId;
  } catch (error) {
    console.error("Error processing referral signup:", error);
    return null;
  }
}

async function processPurchase(userId, challengeId, challengeCost) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.referredBy) {
      return; // User wasn't referred by anyone
    }

    const affiliate = await Affiliate.findOne({ userId: user.referredBy });
    if (!affiliate) {
      console.log("Affiliate not found for referred user");
      return;
    }

    await affiliate.addPurchase(userId, challengeId, challengeCost);
    console.log(`Commission processed for affiliate ${affiliate.userId}`);

    return {
      success: true,
      affiliateId: affiliate._id,
      commissionEarned: (challengeCost * affiliate.commissionPercentage) / 100,
      currentTier: affiliate.tier,
      currentCommissionPercentage: affiliate.commissionPercentage,
    };
  } catch (error) {
    console.error("Error processing purchase commission:", error);
    return { success: false, error: error.message };
  }
}

// Additional utility functions
async function getTierProgress(affiliateId) {
  try {
    const affiliate = await Affiliate.findById(affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found");
    }

    const currentTier = affiliate.tier;
    const totalReferrals = affiliate.totalReferrals;
    const nextTierConfig = TIER_CONFIG[TIER_CONFIG[currentTier].nextTier];

    if (!nextTierConfig) {
      return {
        currentTier,
        totalReferrals,
        isMaxTier: true,
        commissionPercentage: affiliate.commissionPercentage,
      };
    }

    const referralsNeeded = nextTierConfig.minReferrals - totalReferrals;
    const progress = (totalReferrals / nextTierConfig.minReferrals) * 100;

    return {
      currentTier,
      totalReferrals,
      nextTier: TIER_CONFIG[currentTier].nextTier,
      referralsNeeded: Math.max(0, referralsNeeded),
      progress: Math.min(100, progress),
      currentCommissionPercentage: affiliate.commissionPercentage,
      nextTierCommissionPercentage: nextTierConfig.commissionPercentage,
      isMaxTier: false,
    };
  } catch (error) {
    console.error("Error getting tier progress:", error);
    throw error;
  }
}

module.exports = {
  findByReferralCode,
  processReferralSignup,
  processPurchase,
  checkAndUpgradeTier,
  recalculateReferralCommissions,
  getTierProgress,
  TIER_CONFIG,
};
