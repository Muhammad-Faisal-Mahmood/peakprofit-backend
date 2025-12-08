const { Withdraw } = require("../../withdraw/withdraw.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

const getPayoutStats = async (req, res) => {
  try {
    // Ensure user is admin
    if (!req.user || req.user.role !== "Admin") {
      return sendErrorResponse(res, "Unauthorized - Admin access required");
    }

    // Get current date and first day of current month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Run all aggregations in parallel
    const [pendingStats, approvedStats, paidThisMonthStats, lifetimePaidStats] =
      await Promise.all([
        // PENDING requests stats
        Withdraw.aggregate([
          {
            $match: { affiliateId: { $ne: null } }, // Add this filter
          },
          {
            $match: { status: "PENDING" },
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalAmount: { $sum: "$amount" },
            },
          },
        ]),

        // APPROVED (unpaid) requests stats
        Withdraw.aggregate([
          {
            $match: { status: "APPROVED" },
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalAmount: { $sum: "$amount" },
            },
          },
        ]),

        // PAID this month stats
        Withdraw.aggregate([
          {
            $match: {
              status: "PAID",
              processedDate: { $gte: firstDayOfMonth },
            },
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: "$amount" },
            },
          },
        ]),

        // LIFETIME paid stats
        Withdraw.aggregate([
          {
            $match: { status: "PAID" },
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: "$amount" },
            },
          },
        ]),
      ]);

    // Format the response
    const stats = {
      pending: {
        count: pendingStats[0]?.count || 0,
        totalAmount: pendingStats[0]?.totalAmount || 0,
        formattedAmount: `$${(pendingStats[0]?.totalAmount || 0).toLocaleString(
          "en-US",
          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        )}`,
        description: `${pendingStats[0]?.count || 0} requests awaiting review`,
      },
      approvedUnpaid: {
        count: approvedStats[0]?.count || 0,
        totalAmount: approvedStats[0]?.totalAmount || 0,
        formattedAmount: `$${(
          approvedStats[0]?.totalAmount || 0
        ).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        description: `${
          approvedStats[0]?.count || 0
        } requests ready for payment`,
      },
      paidThisMonth: {
        totalAmount: paidThisMonthStats[0]?.totalAmount || 0,
        formattedAmount: `$${(
          paidThisMonthStats[0]?.totalAmount || 0
        ).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        description: "Total paid out this month",
      },
      lifetimePaid: {
        totalAmount: lifetimePaidStats[0]?.totalAmount || 0,
        formattedAmount: `$${(
          lifetimePaidStats[0]?.totalAmount || 0
        ).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        description: "Total paid to all affiliates",
      },
    };

    return sendSuccessResponse(
      res,
      "Admin withdraw stats retrieved successfully",
      stats
    );
  } catch (error) {
    console.error("Error fetching admin withdraw stats:", error);
    return sendErrorResponse(res, "Error retrieving admin withdraw stats");
  }
};

module.exports = getPayoutStats;
