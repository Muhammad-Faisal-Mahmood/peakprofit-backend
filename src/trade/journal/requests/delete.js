const TradeJournal = require("../journal.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../shared/response.service");

async function deleteJournal(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const deletedJournal = await TradeJournal.findOneAndDelete({
      _id: id,
      createdBy: userId,
    });

    if (!deletedJournal) {
      return sendErrorResponse(res, "Journal not found or not authorized.");
    }

    return sendSuccessResponse(
      res,
      "Journal deleted successfully.",
      deletedJournal
    );
  } catch (error) {
    console.error("Error deleting journal:", error);
    return sendErrorResponse(
      res,
      "Something went wrong while deleting the journal."
    );
  }
}

module.exports = deleteJournal;
