const Commission = require("../../affiliate/commission/commission.model");
const Affiliate = require("../../affiliate/affiliate.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
async function getAdminYearlyStats(year = null) {
  try {
    const targetYear = year || new Date().getFullYear();

    // Get monthly breakdown from all affiliates
    const monthlyData = await Commission.aggregate([
      {
        $match: {
          earnedAt: {
            $gte: new Date(`${targetYear}-01-01`),
            $lt: new Date(`${targetYear + 1}-01-01`),
          },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: "$earnedAt" },
            type: "$type",
          },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
          uniqueAffiliates: { $addToSet: "$affiliate" },
        },
      },
      {
        $sort: { "_id.month": 1, "_id.type": 1 },
      },
    ]);

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
          uniqueAffiliates: 0,
        },
        purchases: {
          count: 0,
          amount: 0,
          uniqueAffiliates: 0,
        },
        total: {
          count: 0,
          amount: 0,
          uniqueAffiliates: new Set(),
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
          monthlyStats[monthIndex].signups.uniqueAffiliates =
            item.uniqueAffiliates.length;
        } else if (type === "PURCHASE") {
          monthlyStats[monthIndex].purchases.count = item.count;
          monthlyStats[monthIndex].purchases.amount = item.totalAmount;
          monthlyStats[monthIndex].purchases.uniqueAffiliates =
            item.uniqueAffiliates.length;
        }

        // Update totals
        monthlyStats[monthIndex].total.count += item.count;
        monthlyStats[monthIndex].total.amount += item.totalAmount;

        // Add unique affiliates to the set
        item.uniqueAffiliates.forEach((affiliateId) => {
          monthlyStats[monthIndex].total.uniqueAffiliates.add(
            affiliateId.toString()
          );
        });
      }
    });

    // Convert sets to counts for final output
    monthlyStats.forEach((month) => {
      month.total.uniqueAffiliates = month.total.uniqueAffiliates.size;
    });

    // Calculate year totals
    const yearTotals = monthlyStats.reduce(
      (acc, month) => ({
        signups: {
          count: acc.signups.count + month.signups.count,
          amount: acc.signups.amount + month.signups.amount,
          uniqueAffiliates:
            acc.signups.uniqueAffiliates + month.signups.uniqueAffiliates,
        },
        purchases: {
          count: acc.purchases.count + month.purchases.count,
          amount: acc.purchases.amount + month.purchases.amount,
          uniqueAffiliates:
            acc.purchases.uniqueAffiliates + month.purchases.uniqueAffiliates,
        },
        total: {
          count: acc.total.count + month.total.count,
          amount: acc.total.amount + month.total.amount,
        },
      }),
      {
        signups: { count: 0, amount: 0, uniqueAffiliates: 0 },
        purchases: { count: 0, amount: 0, uniqueAffiliates: 0 },
        total: { count: 0, amount: 0 },
      }
    );

    // Get total unique affiliates for the year
    const yearUniqueAffiliates = await Commission.distinct("affiliate", {
      earnedAt: {
        $gte: new Date(`${targetYear}-01-01`),
        $lt: new Date(`${targetYear + 1}-01-01`),
      },
    });

    yearTotals.total.uniqueAffiliates = yearUniqueAffiliates.length;

    // Find best and worst performing months
    const sortedMonths = monthlyStats
      .map((month, index) => ({ ...month, index }))
      .filter((month) => month.total.amount > 0)
      .sort((a, b) => b.total.amount - a.total.amount);

    const bestMonth = sortedMonths.length > 0 ? sortedMonths[0] : null;
    const worstMonth =
      sortedMonths.length > 0 ? sortedMonths[sortedMonths.length - 1] : null;

    // Get top performing affiliates for the year
    const topAffiliates = await Commission.aggregate([
      {
        $match: {
          earnedAt: {
            $gte: new Date(`${targetYear}-01-01`),
            $lt: new Date(`${targetYear + 1}-01-01`),
          },
        },
      },
      {
        $group: {
          _id: "$affiliate",
          totalAmount: { $sum: "$amount" },
          totalCount: { $sum: 1 },
          signupCount: {
            $sum: { $cond: [{ $eq: ["$type", "SIGNUP"] }, 1, 0] },
          },
          purchaseCount: {
            $sum: { $cond: [{ $eq: ["$type", "PURCHASE"] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: "affiliates",
          localField: "_id",
          foreignField: "_id",
          as: "affiliate",
        },
      },
      {
        $unwind: "$affiliate",
      },
      {
        $sort: { totalAmount: -1 },
      },
      {
        $limit: 10,
      },
      {
        $project: {
          affiliateId: "$_id",
          referralCode: "$affiliate.referralCode",
          tier: "$affiliate.tier",
          totalAmount: 1,
          totalCount: 1,
          signupCount: 1,
          purchaseCount: 1,
        },
      },
    ]);

    return {
      year: targetYear,
      monthlyBreakdown: monthlyStats,
      yearTotals,
      insights: {
        bestMonth: bestMonth
          ? {
              month: bestMonth.monthName,
              amount: bestMonth.total.amount,
              count: bestMonth.total.count,
              uniqueAffiliates: bestMonth.total.uniqueAffiliates,
            }
          : null,
        worstMonth:
          worstMonth && sortedMonths.length > 1
            ? {
                month: worstMonth.monthName,
                amount: worstMonth.total.amount,
                count: worstMonth.total.count,
                uniqueAffiliates: worstMonth.total.uniqueAffiliates,
              }
            : null,
        activeMonths: sortedMonths.length,
        averageMonthlyEarnings:
          sortedMonths.length > 0 ? yearTotals.total.amount / 12 : 0,
        topPerformingAffiliates: topAffiliates,
      },
    };
  } catch (error) {
    console.error("Error getting admin yearly stats:", error);
    throw error;
  }
}

async function getAdminDashboardStats() {
  try {
    const now = new Date();

    // Get start of current week (Monday)
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    // Get start of current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get lifetime earnings from all affiliates
    const lifetimeStats = await Commission.aggregate([
      {
        $group: {
          _id: null,
          totalCommissions: { $sum: "$amount" },
          totalEntries: { $sum: 1 },
          signupCommissions: {
            $sum: {
              $cond: [{ $eq: ["$type", "SIGNUP"] }, "$amount", 0],
            },
          },
          purchaseCommissions: {
            $sum: {
              $cond: [{ $eq: ["$type", "PURCHASE"] }, "$amount", 0],
            },
          },
          signupCount: {
            $sum: {
              $cond: [{ $eq: ["$type", "SIGNUP"] }, 1, 0],
            },
          },
          purchaseCount: {
            $sum: {
              $cond: [{ $eq: ["$type", "PURCHASE"] }, 1, 0],
            },
          },
          uniqueAffiliates: { $addToSet: "$affiliate" },
        },
      },
    ]);

    // Get this month's commissions
    const monthlyStats = await Commission.aggregate([
      {
        $match: {
          earnedAt: {
            $gte: startOfMonth,
            $lte: now,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalCommissions: { $sum: "$amount" },
          totalEntries: { $sum: 1 },
          signupCommissions: {
            $sum: {
              $cond: [{ $eq: ["$type", "SIGNUP"] }, "$amount", 0],
            },
          },
          purchaseCommissions: {
            $sum: {
              $cond: [{ $eq: ["$type", "PURCHASE"] }, "$amount", 0],
            },
          },
          signupCount: {
            $sum: {
              $cond: [{ $eq: ["$type", "SIGNUP"] }, 1, 0],
            },
          },
          purchaseCount: {
            $sum: {
              $cond: [{ $eq: ["$type", "PURCHASE"] }, 1, 0],
            },
          },
          uniqueAffiliates: { $addToSet: "$affiliate" },
        },
      },
    ]);

    // Get this week's commissions
    const weeklyStats = await Commission.aggregate([
      {
        $match: {
          earnedAt: {
            $gte: startOfWeek,
            $lte: now,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalCommissions: { $sum: "$amount" },
          totalEntries: { $sum: 1 },
          signupCommissions: {
            $sum: {
              $cond: [{ $eq: ["$type", "SIGNUP"] }, "$amount", 0],
            },
          },
          purchaseCommissions: {
            $sum: {
              $cond: [{ $eq: ["$type", "PURCHASE"] }, "$amount", 0],
            },
          },
          signupCount: {
            $sum: {
              $cond: [{ $eq: ["$type", "SIGNUP"] }, 1, 0],
            },
          },
          purchaseCount: {
            $sum: {
              $cond: [{ $eq: ["$type", "PURCHASE"] }, 1, 0],
            },
          },
          uniqueAffiliates: { $addToSet: "$affiliate" },
        },
      },
    ]);

    // Get total affiliate counts and stats
    const affiliateStats = await Affiliate.aggregate([
      {
        $group: {
          _id: null,
          totalAffiliates: { $sum: 1 },
          activeAffiliates: {
            $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
          },
          totalBalance: { $sum: "$balance" },
          totalReferrals: { $sum: "$totalReferrals" },
          tierBreakdown: {
            $push: "$tier",
          },
        },
      },
    ]);

    // Process tier breakdown
    let tierCounts = { BRONZE: 0, SILVER: 0, GOLD: 0, PLATINUM: 0 };
    if (affiliateStats.length > 0 && affiliateStats[0].tierBreakdown) {
      affiliateStats[0].tierBreakdown.forEach((tier) => {
        if (tierCounts.hasOwnProperty(tier)) {
          tierCounts[tier]++;
        }
      });
    }

    // Get withdrawal stats across all affiliates
    const withdrawalStats = await Affiliate.aggregate([
      {
        $lookup: {
          from: "withdraws", // Assuming withdraw collection name
          localField: "withdraws",
          foreignField: "_id",
          as: "withdrawalData",
        },
      },
      {
        $unwind: {
          path: "$withdrawalData",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: null,
          totalWithdrawals: {
            $sum: { $ifNull: ["$withdrawalData.amount", 0] },
          },
          totalWithdrawalCount: {
            $sum: { $cond: [{ $ne: ["$withdrawalData", null] }, 1, 0] },
          },
          paidWithdrawals: {
            $sum: {
              $cond: [
                { $eq: ["$withdrawalData.status", "PAID"] },
                "$withdrawalData.amount",
                0,
              ],
            },
          },
          paidWithdrawalCount: {
            $sum: {
              $cond: [{ $eq: ["$withdrawalData.status", "PAID"] }, 1, 0],
            },
          },
          pendingWithdrawals: {
            $sum: {
              $cond: [
                { $eq: ["$withdrawalData.status", "PENDING"] },
                "$withdrawalData.amount",
                0,
              ],
            },
          },
          pendingWithdrawalCount: {
            $sum: {
              $cond: [{ $eq: ["$withdrawalData.status", "PENDING"] }, 1, 0],
            },
          },
        },
      },
    ]);

    // Helper function to format stats with defaults
    const formatStats = (statsArray) => {
      if (statsArray.length === 0) {
        return {
          totalCommissions: 0,
          totalEntries: 0,
          signupCommissions: 0,
          purchaseCommissions: 0,
          signupCount: 0,
          purchaseCount: 0,
          uniqueAffiliates: 0,
        };
      }
      const stats = statsArray[0];
      return {
        totalCommissions: stats.totalCommissions || 0,
        totalEntries: stats.totalEntries || 0,
        signupCommissions: stats.signupCommissions || 0,
        purchaseCommissions: stats.purchaseCommissions || 0,
        signupCount: stats.signupCount || 0,
        purchaseCount: stats.purchaseCount || 0,
        uniqueAffiliates: stats.uniqueAffiliates
          ? stats.uniqueAffiliates.length
          : 0,
      };
    };

    const lifetime = formatStats(lifetimeStats);
    const thisMonth = formatStats(monthlyStats);
    const thisWeek = formatStats(weeklyStats);

    const affiliateData =
      affiliateStats.length > 0
        ? affiliateStats[0]
        : {
            totalAffiliates: 0,
            activeAffiliates: 0,
            totalBalance: 0,
            totalReferrals: 0,
          };

    const withdrawalData =
      withdrawalStats.length > 0
        ? withdrawalStats[0]
        : {
            totalWithdrawals: 0,
            totalWithdrawalCount: 0,
            paidWithdrawals: 0,
            paidWithdrawalCount: 0,
            pendingWithdrawals: 0,
            pendingWithdrawalCount: 0,
          };

    return {
      overview: {
        totalAffiliates: affiliateData.totalAffiliates,
        activeAffiliates: affiliateData.activeAffiliates,
        totalBalance: affiliateData.totalBalance,
        totalReferrals: affiliateData.totalReferrals,
        tierBreakdown: tierCounts,
      },
      earnings: {
        lifetime,
        thisMonth,
        thisWeek,
      },
      withdrawals: {
        paid: {
          count: withdrawalData.paidWithdrawalCount,
          amount: withdrawalData.paidWithdrawals,
        },
        pending: {
          count: withdrawalData.pendingWithdrawalCount,
          amount: withdrawalData.pendingWithdrawals,
        },
        total: {
          count: withdrawalData.totalWithdrawalCount,
          amount: withdrawalData.totalWithdrawals,
        },
      },
    };
  } catch (error) {
    console.error("Error getting admin dashboard stats:", error);
    throw error;
  }
}

const getCommissionStats = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== "Admin") {
      return sendErrorResponse(res, "Access denied. Admin privileges required");
    }

    // Optional year parameter from query string, defaults to current year
    const year = req.query.year
      ? parseInt(req.query.year)
      : new Date().getFullYear();

    // Validate year if provided
    if (req.query.year && (isNaN(year) || year < 2020 || year > 2030)) {
      return sendErrorResponse(
        res,
        "Invalid year parameter. Must be between 2020 and 2030"
      );
    }

    // Call both admin analytics functions in parallel for better performance
    const [dashboardStats, yearlyStats] = await Promise.all([
      getAdminDashboardStats(),
      getAdminYearlyStats(year),
    ]);

    // Merge the responses
    const mergedResponse = {
      dashboard: {
        overview: dashboardStats.overview,
        earnings: dashboardStats.earnings,
        withdrawals: dashboardStats.withdrawals,
      },
      yearly: {
        year: yearlyStats.year,
        monthlyBreakdown: yearlyStats.monthlyBreakdown,
        yearTotals: yearlyStats.yearTotals,
        insights: yearlyStats.insights,
      },
      metadata: {
        requestedYear: year,
        currentYear: new Date().getFullYear(),
        generatedAt: new Date().toISOString(),
        adminId: req.user.id,
      },
    };

    return sendSuccessResponse(
      res,
      "Admin statistics retrieved successfully",
      mergedResponse
    );
  } catch (error) {
    console.error("Error in AdminStats controller:", error);

    // Generic error response for admin stats
    return sendErrorResponse(res, "Failed to retrieve admin statistics");
  }
};

module.exports = { getCommissionStats };
