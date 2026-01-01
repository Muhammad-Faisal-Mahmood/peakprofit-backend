const Affiliate = require("./affiliate.model"); // Adjust path as needed
const User = require("../user/user.model"); // Adjust path as needed
const Commission = require("./commission/commission.model"); // Add this new model

// Tier upgrade thresholds and benefits

const signupCommission = 1;
const TIER_CONFIG = {
  BRONZE: {
    minReferrals: 0,
    commissionPercentage: 10,
    nextTier: "SILVER",
    minEarning: 0,
    maxEarning: 499,
  },
  SILVER: {
    minReferrals: 25,
    commissionPercentage: 15,
    nextTier: "GOLD",
    minEarning: 500,
    maxEarning: 1999,
  },
  GOLD: {
    minReferrals: 50,
    commissionPercentage: 20,
    nextTier: "PLATINUM",
    minEarning: 2000,
    maxEarning: 4999,
  },
  PLATINUM: {
    minReferrals: 75,
    commissionPercentage: 25,
    nextTier: null, // Highest tier
    minEarning: 5000,
  },
};

async function findByReferralCode(referralCode) {
  return await Affiliate.findOne({ referralCode });
}

// Function to create a commission entry
async function createCommissionEntry({
  affiliateId,
  referredUserId,
  type,
  amount,
  commissionPercentage,
  affiliateTier,
  referralCode,
  challengeId = null,
  originalAmount = null,
  purchaseDate = null,
}) {
  try {
    const commissionData = {
      affiliate: affiliateId,
      referredUser: referredUserId,
      type,
      amount,
      commissionPercentage,
      affiliateTier,
      metadata: {
        referralCode,
        purchaseDate,
      },
    };

    // Add challenge-specific data for purchases
    if (type === "PURCHASE" && challengeId && originalAmount) {
      commissionData.challenge = challengeId;
      commissionData.originalAmount = originalAmount;
    }

    const commission = new Commission(commissionData);
    await commission.save();

    console.log(
      `💰 Commission entry created: ${type} - $${amount} for affiliate ${referralCode}`
    );

    return commission;
  } catch (error) {
    console.error("Error creating commission entry:", error);
    throw error;
  }
}

// Function to check and upgrade affiliate tier
// Function to check and upgrade affiliate tier
async function checkAndUpgradeTier(affiliate) {
  const currentTier = affiliate.tier;
  const totalReferrals = affiliate.totalReferrals;
  const totalEarnings = affiliate.totalEarnings;

  let newTier = currentTier;
  let upgraded = false;

  // Check tier upgrades - must meet BOTH referral and earning requirements
  if (
    currentTier === "BRONZE" &&
    totalReferrals >= TIER_CONFIG.SILVER.minReferrals &&
    totalEarnings >= TIER_CONFIG.SILVER.minEarning
  ) {
    newTier = "SILVER";
    upgraded = true;
  } else if (
    currentTier === "SILVER" &&
    totalReferrals >= TIER_CONFIG.GOLD.minReferrals &&
    totalEarnings >= TIER_CONFIG.GOLD.minEarning
  ) {
    newTier = "GOLD";
    upgraded = true;
  } else if (
    currentTier === "GOLD" &&
    totalReferrals >= TIER_CONFIG.PLATINUM.minReferrals &&
    totalEarnings >= TIER_CONFIG.PLATINUM.minEarning
  ) {
    newTier = "PLATINUM";
    upgraded = true;
  }

  if (upgraded) {
    const oldCommissionPercentage = affiliate.commissionPercentage;

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

async function processReferralSignup(referralCode, newUserId) {
  if (!referralCode) return null;

  try {
    const affiliate = await findByReferralCode(referralCode);
    if (!affiliate) {
      console.log(`Invalid referral code: ${referralCode}`);
      return null;
    }

    await affiliate.addReferral(newUserId);

    // Create detailed commission entry
    await createCommissionEntry({
      affiliateId: affiliate._id,
      referredUserId: newUserId,
      type: "SIGNUP",
      amount: signupCommission,
      commissionPercentage: affiliate.commissionPercentage,
      affiliateTier: affiliate.tier,
      referralCode: affiliate.referralCode,
    });

    await affiliate.save();

    // Check for tier upgrade after adding referral
    const upgradeResult = await checkAndUpgradeTier(affiliate);

    console.log(
      `✅ Referral signup processed: ${referralCode} -> User ${newUserId}`
    );

    return {
      affiliateUserId: affiliate.userId,
      commissionEarned: signupCommission,
      currentTier: affiliate.tier,
      tierUpgrade: upgradeResult,
    };
  } catch (error) {
    console.error("Error processing referral signup:", error);
    return null;
  }
}

async function processPurchase(userId, challengeId, challengeCost) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.referredBy) {
      console.log("User not referred by anyone or user not found");
      return { success: false, reason: "No referral found" };
    }

    const affiliate = await Affiliate.findOne({ userId: user.referredBy });
    if (!affiliate) {
      console.log("Affiliate not found for referred user");
      return { success: false, reason: "Affiliate not found" };
    }

    const commissionAmount =
      (challengeCost * affiliate.commissionPercentage) / 100;

    // Create detailed commission entry
    await createCommissionEntry({
      affiliateId: affiliate._id,
      referredUserId: userId,
      type: "PURCHASE",
      amount: commissionAmount,
      commissionPercentage: affiliate.commissionPercentage,
      affiliateTier: affiliate.tier,
      referralCode: affiliate.referralCode,
      challengeId: challengeId,
      originalAmount: challengeCost,
      purchaseDate: new Date(),
      notes: "Challenge purchase commission",
    });

    // Update affiliate totals
    affiliate.totalEarnings += commissionAmount;
    affiliate.balance += commissionAmount;
    const savedAffiliate = await affiliate.save();

    console.log(
      `💰 Purchase commission processed: $${commissionAmount} for affiliate ${affiliate.referralCode}`
    );

    checkAndUpgradeTier(savedAffiliate);

    return {
      success: true,
      affiliateId: affiliate._id,
      commissionEarned: commissionAmount,
      currentTier: affiliate.tier,
      currentCommissionPercentage: affiliate.commissionPercentage,
    };
  } catch (error) {
    console.error("Error processing purchase commission:", error);
    return { success: false, error: error.message };
  }
}

// Function to get affiliate commission history
async function getAffiliateCommissions(affiliateId, options = {}) {
  try {
    const {
      page = 1,
      limit = 10,
      type = null, // 'SIGNUP' or 'PURCHASE'
      startDate = null,
      endDate = null,
      sortBy = "earnedAt",
      sortOrder = "desc",
      search = null, // New search parameter
    } = options;

    // Build the base query
    const query = { affiliate: affiliateId };

    if (type) {
      query.type = type;
    }

    if (startDate || endDate) {
      query.earnedAt = {};
      if (startDate) query.earnedAt.$gte = new Date(startDate);
      if (endDate) query.earnedAt.$lte = new Date(endDate);
    }

    // Handle search functionality
    let searchQuery = query;
    if (search) {
      // Split search terms (handles cases where + was converted to space)
      const searchTerms = search.trim().split(/\s+/);

      // Create regex patterns for each search term
      const searchConditions = [];

      searchTerms.forEach((term) => {
        searchConditions.push(
          { name: { $regex: term, $options: "i" } },
          { email: { $regex: term, $options: "i" } }
        );
      });

      // Find users that match any of the search terms
      const matchingUsers = await User.find({
        $or: searchConditions,
      }).select("_id");

      const userIds = matchingUsers.map((user) => user._id);

      // Add the user filter to the commission query
      searchQuery = {
        ...query,
        referredUser: { $in: userIds },
      };
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const commissions = await Commission.find(searchQuery)
      .populate("referredUser", "name email")
      .populate("challenge", "cost name")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const totalCommissions = await Commission.countDocuments(searchQuery);

    return {
      commissions: commissions.map((commission) => commission.getDisplayInfo()),
      totalCommissions,
      currentPage: page,
      totalPages: Math.ceil(totalCommissions / limit),
      hasNextPage: page < Math.ceil(totalCommissions / limit),
      hasPrevPage: page > 1,
    };
  } catch (error) {
    console.error("Error getting affiliate commissions:", error);
    throw error;
  }
}

// Function to get commission analytics
async function getCommissionAnalytics(affiliateId, timeframe = "last30days") {
  try {
    let startDate;
    const endDate = new Date();

    switch (timeframe) {
      case "last7days":
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "last30days":
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "last90days":
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "thisyear":
        startDate = new Date(new Date().getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const summary = await Commission.getAffiliateSummary(affiliateId, {
      startDate,
      endDate,
    });
    const monthlyData = await Commission.getMonthlyBreakdown(
      affiliateId,
      new Date().getFullYear()
    );

    return {
      timeframe,
      summary,
      monthlyBreakdown: monthlyData,
      dateRange: { startDate, endDate },
    };
  } catch (error) {
    console.error("Error getting commission analytics:", error);
    throw error;
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

async function getAffiliateYearlyStats(affiliateId, year = null) {
  try {
    const affiliate = await Affiliate.findById(affiliateId);
    if (!affiliate) {
      throw new Error("Affiliate not found");
    }

    const targetYear = year || new Date().getFullYear();

    // Get monthly breakdown from Commission model
    const monthlyData = await Commission.getMonthlyBreakdown(
      affiliateId,
      targetYear
    );

    // Initialize months array with zero values
    const monthlyStats = [];
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    for (let i = 1; i <= 12; i++) {
      monthlyStats.push({
        month: i,
        monthName: monthNames[i - 1],
        signups: {
          count: 0,
          amount: 0,
        },
        purchases: {
          count: 0,
          amount: 0,
        },
        total: {
          count: 0,
          amount: 0,
        },
      });
    }

    // Fill in actual data from the database
    monthlyData.forEach((item) => {
      const monthIndex = item._id.month - 1; // Convert to 0-based index
      const type = item._id.type;

      if (monthIndex >= 0 && monthIndex < 12) {
        if (type === "SIGNUP") {
          monthlyStats[monthIndex].signups.count = item.count;
          monthlyStats[monthIndex].signups.amount = item.totalAmount;
        } else if (type === "PURCHASE") {
          monthlyStats[monthIndex].purchases.count = item.count;
          monthlyStats[monthIndex].purchases.amount = item.totalAmount;
        }

        // Update totals
        monthlyStats[monthIndex].total.count += item.count;
        monthlyStats[monthIndex].total.amount += item.totalAmount;
      }
    });

    // Calculate year totals
    const yearTotals = monthlyStats.reduce(
      (acc, month) => ({
        signups: {
          count: acc.signups.count + month.signups.count,
          amount: acc.signups.amount + month.signups.amount,
        },
        purchases: {
          count: acc.purchases.count + month.purchases.count,
          amount: acc.purchases.amount + month.purchases.amount,
        },
        total: {
          count: acc.total.count + month.total.count,
          amount: acc.total.amount + month.total.amount,
        },
      }),
      {
        signups: { count: 0, amount: 0 },
        purchases: { count: 0, amount: 0 },
        total: { count: 0, amount: 0 },
      }
    );

    // Find best and worst performing months
    const sortedMonths = monthlyStats
      .map((month, index) => ({ ...month, index }))
      .filter((month) => month.total.amount > 0)
      .sort((a, b) => b.total.amount - a.total.amount);

    const bestMonth = sortedMonths.length > 0 ? sortedMonths[0] : null;
    const worstMonth =
      sortedMonths.length > 0 ? sortedMonths[sortedMonths.length - 1] : null;

    return {
      affiliate: {
        id: affiliate._id,
        referralCode: affiliate.referralCode,
        tier: affiliate.tier,
        commissionPercentage: affiliate.commissionPercentage,
      },
      year: targetYear,
      monthlyBreakdown: monthlyStats,
      yearTotals,
      insights: {
        bestMonth: bestMonth
          ? {
              month: bestMonth.monthName,
              amount: bestMonth.total.amount,
              count: bestMonth.total.count,
            }
          : null,
        worstMonth:
          worstMonth && sortedMonths.length > 1
            ? {
                month: worstMonth.monthName,
                amount: worstMonth.total.amount,
                count: worstMonth.total.count,
              }
            : null,
        activeMonths: sortedMonths.length,
        averageMonthlyEarnings:
          sortedMonths.length > 0 ? yearTotals.total.amount / 12 : 0,
      },
    };
  } catch (error) {
    console.error("Error getting affiliate yearly stats:", error);
    throw error;
  }
}

async function getAffiliateDashboardStats(affiliateId) {
  try {
    const affiliate = await Affiliate.findById(affiliateId).populate(
      "withdraws"
    );
    if (!affiliate) {
      throw new Error("Affiliate not found");
    }

    console.log("affiliate: ", affiliate);

    const now = new Date();

    // Get start of current week (Monday)
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    // Get start of current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get lifetime earnings from Commission model
    const lifetimeStats = await Commission.getAffiliateSummary(affiliateId);

    // Get this month's commissions
    const monthlyStats = await Commission.getAffiliateSummary(affiliateId, {
      startDate: startOfMonth,
      endDate: now,
    });

    // Get this week's commissions
    const weeklyStats = await Commission.getAffiliateSummary(affiliateId, {
      startDate: startOfWeek,
      endDate: now,
    });

    // Process withdrawals if they exist
    let withdrawalStats = {
      paid: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      total: { count: 0, amount: 0 },
    };

    if (affiliate.withdraws && affiliate.withdraws.length > 0) {
      for (const withdrawal of affiliate.withdraws) {
        withdrawalStats.total.count++;
        withdrawalStats.total.amount += withdrawal.amount || 0;

        if (withdrawal.status === "PAID") {
          withdrawalStats.paid.count++;
          withdrawalStats.paid.amount += withdrawal.amount || 0;
        } else if (withdrawal.status === "PENDING") {
          withdrawalStats.pending.count++;
          withdrawalStats.pending.amount += withdrawal.amount || 0;
        }
      }
    }

    return {
      affiliate: {
        id: affiliate._id,
        referralCode: affiliate.referralCode,
        tier: affiliate.tier,
        commissionPercentage: affiliate.commissionPercentage,
        totalReferrals: affiliate.totalReferrals,
        availableBalance: affiliate.balance,
        isActive: affiliate.isActive,
      },
      earnings: {
        lifetime: {
          total: lifetimeStats.totalCommissions,
          signups: lifetimeStats.signupCommissions,
          purchases: lifetimeStats.purchaseCommissions,
          signupCount: lifetimeStats.signupCount,
          purchaseCount: lifetimeStats.purchaseCount,
        },
        thisMonth: {
          total: monthlyStats.totalCommissions,
          signups: monthlyStats.signupCommissions,
          purchases: monthlyStats.purchaseCommissions,
          signupCount: monthlyStats.signupCount,
          purchaseCount: monthlyStats.purchaseCount,
        },
        thisWeek: {
          total: weeklyStats.totalCommissions,
          signups: weeklyStats.signupCommissions,
          purchases: weeklyStats.purchaseCommissions,
          signupCount: weeklyStats.signupCount,
          purchaseCount: weeklyStats.purchaseCount,
        },
      },
      withdrawals: withdrawalStats,
    };
  } catch (error) {
    console.error("Error getting affiliate dashboard stats:", error);
    throw error;
  }
}

module.exports = {
  findByReferralCode,
  getAffiliateYearlyStats,
  getAffiliateDashboardStats,
  processReferralSignup,
  processPurchase,
  checkAndUpgradeTier,
  getTierProgress,
  getAffiliateCommissions,
  getCommissionAnalytics,
  createCommissionEntry,
  TIER_CONFIG,
};
