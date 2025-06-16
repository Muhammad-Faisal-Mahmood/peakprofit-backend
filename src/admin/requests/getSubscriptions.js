const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");
const Subscription = require("../../subscription/subscription.model");
const GeneralHelper = require("../../shared/GeneralHelper");

const getAllSubscriptions = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "Admin") {
      return sendErrorResponse(res, "Unauthorized: Admins only.");
    }

    // Get pagination parameters from query (default to page 1 if not specified)
    const pageNo = parseInt(req.query.page) || 1;
    const searchValue = req.query.search || null;

    // Get pagination details
    let pg = GeneralHelper.getPaginationDetails(pageNo);

    // Initialize base condition
    let condition = {};

    // Add search filter if searchValue exists
    if (searchValue) {
      const regex = GeneralHelper.makeRegex(searchValue);
      condition.email = regex;
    }

    // Get paginated results
    let result = await Subscription.find(condition)
      .sort({ createdAt: -1 })
      .skip(pg.skip)
      .limit(pg.pageSize)
      .exec();

    // Get total count
    let total = await Subscription.countDocuments(condition);

    return sendSuccessResponse(res, "Subscriptions fetched successfully", {
      pagination: GeneralHelper.makePaginationObject(
        pg.pageNo,
        pg.pageSize,
        pg.skip,
        total,
        result.length
      ),
      data: result,
    });
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return sendErrorResponse(res, "Failed to fetch subscriptions");
  }
};

module.exports = getAllSubscriptions;
