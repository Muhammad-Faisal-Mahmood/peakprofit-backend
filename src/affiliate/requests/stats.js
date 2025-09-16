const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service"); // Adjust path as needed
const {
  getAffiliateDashboardStats,
  getAffiliateYearlyStats,
} = require("../affiliate.service"); // Adjust path as needed

const stats = async (req, res) => {
  try {
    // Get affiliate ID from authenticated user
    const affiliateId = req.user?.affiliateId;

    if (!affiliateId) {
      return sendErrorResponse(res, "Affiliate ID not found in user session");
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

    // Call both analytics functions in parallel for better performance
    const [dashboardStats, yearlyStats] = await Promise.all([
      getAffiliateDashboardStats(affiliateId),
      getAffiliateYearlyStats(affiliateId, year),
    ]);

    // Merge the responses
    const mergedResponse = {
      dashboard: {
        affiliate: dashboardStats.affiliate,
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
        affiliateId: affiliateId,
      },
    };

    return sendSuccessResponse(
      res,
      "Affiliate statistics retrieved successfully",
      mergedResponse
    );
  } catch (error) {
    console.error("Error in AffiliateStats controller:", error);

    // Handle specific error types
    if (error.message === "Affiliate not found") {
      return sendErrorResponse(res, "Affiliate profile not found");
    }

    // Generic error response
    return sendErrorResponse(res, "Failed to retrieve affiliate statistics");
  }
};

module.exports = { stats };
