const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../shared/response.service");
const Chart = require("../chart.model");

async function setInterval(req, res) {
  try {
    const userId = req.user?.userId;
    const { interval } = req.body;

    if (!userId) {
      return sendErrorResponse(res, "User not authenticated.");
    }

    if (!interval) {
      return sendErrorResponse(res, "Interval is required.");
    }

    const updatedChart = await Chart.findOneAndUpdate(
      { userId },
      { interval },
      { new: true, upsert: true, runValidators: true }
    );

    return sendSuccessResponse(res, "Chart interval saved successfully.", {
      interval: updatedChart.interval,
    });
  } catch (error) {
    // Mongo validation error (e.g. enum)
    if (error.name === "ValidationError") {
      const allowedValues = Chart.schema.path("interval").enumValues.join(", ");
      return sendErrorResponse(
        res,
        `Only the following interval values are allowed: ${allowedValues}`
      );
    }

    console.error("Error setting chart interval:", error?.message);
    return sendErrorResponse(res, "Failed to update chart interval.");
  }
}

module.exports = setInterval;
