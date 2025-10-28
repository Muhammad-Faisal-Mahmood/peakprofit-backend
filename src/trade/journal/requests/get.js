const TradeJournal = require("../journal.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../shared/response.service");
async function getUserJournals(req, res) {
  try {
    const userId = req.user.userId;
    const journals = await TradeJournal.find({ createdBy: userId }).sort({
      createdAt: -1,
    });

    return sendSuccessResponse(res, "Journals fetched successfully.", journals);
  } catch (error) {
    console.error("Error fetching journals:", error);
    return sendErrorResponse(
      res,
      "Something went wrong while fetching journals."
    );
  }
}

module.exports = getUserJournals;
