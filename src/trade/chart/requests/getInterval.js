const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../shared/response.service");
const Chart = require("../chart.model");

async function getInterval(req, res) {
  try {
    const userId = req.user.userId;

    if (!userId) {
      return sendErrorResponse(res, "User not authenticated.");
    }
    const chartSettings = await Chart.findOne({ userId });
    if (!chartSettings) {
      return sendErrorResponse(res, "Interval not found for user.");
    }
    return sendSuccessResponse(res, "Chart interval fetched successfully.", {
      interval: chartSettings.interval,
    });
  } catch (error) {
    console.error("Error fetching chart interval:", error?.message);
    return sendErrorResponse(res, "Failed to fetch chart interval.");
  }
}

module.exports = getInterval;
