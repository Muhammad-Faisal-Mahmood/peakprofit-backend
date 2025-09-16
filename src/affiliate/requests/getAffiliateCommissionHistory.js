const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const { getAffiliateCommissions } = require("../affiliate.service"); // Adjust path as needed
const ResponseCode = require("../../shared/ResponseCode");

/**
 * Controller to get affiliate commission history
 */
async function getAffiliateCommissionHistory(req, res) {
  try {
    // Check if user has affiliateId
    if (!req.user || !req.user.affiliateId) {
      return sendErrorResponse(res, "User is not registered as an affiliate");
    }

    const affiliateId = req.user.affiliateId;
    const {
      page = 1,
      limit = 10,
      type,
      startDate,
      endDate,
      sortBy = "earnedAt",
      sortOrder = "desc",
      search,
    } = req.query;

    // Build options object from query parameters
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      type: type || null,
      startDate: startDate || null,
      endDate: endDate || null,
      sortBy,
      sortOrder,
      search,
    };

    // Validate numeric parameters
    if (isNaN(options.page) || options.page < 1) {
      return sendErrorResponse(res, "Page must be a positive integer");
    }

    if (isNaN(options.limit) || options.limit < 1 || options.limit > 100) {
      return sendErrorResponse(res, "Limit must be between 1 and 100");
    }

    // Validate type if provided
    if (options.type && !["SIGNUP", "PURCHASE"].includes(options.type)) {
      return sendErrorResponse(
        res,
        "Type must be either 'SIGNUP' or 'PURCHASE'"
      );
    }

    // Validate sortOrder
    if (!["asc", "desc"].includes(options.sortOrder.toLowerCase())) {
      return sendErrorResponse(
        res,
        "Sort order must be either 'asc' or 'desc'"
      );
    }

    // Get commissions data
    const commissionsData = await getAffiliateCommissions(affiliateId, options);

    return sendSuccessResponse(
      res,
      "Commissions retrieved successfully",
      commissionsData
    );
  } catch (error) {
    console.error("Error in getAffiliateCommissionsController:", error);

    // Handle specific errors
    if (error.name === "CastError") {
      return sendErrorResponse(res, "Invalid affiliate ID format");
    }

    return res.status(ResponseCode.EXCEPTION).json({
      message: "Internal server error while retrieving commissions",
    });
  }
}

module.exports = {
  getAffiliateCommissionHistory,
};
