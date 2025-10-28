const TradeJournal = require("../journal.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../shared/response.service");
async function updateJournal(req, res) {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    const userId = req.user.userId;

    if (!title || !content) {
      return sendErrorResponse(res, "Title and content are required.");
    }

    const updatedJournal = await TradeJournal.findOneAndUpdate(
      { _id: id, createdBy: userId },
      { title, content },
      { new: true }
    );

    if (!updatedJournal) {
      return sendErrorResponse(res, "Journal not found or not authorized.");
    }

    return sendSuccessResponse(
      res,
      "Journal updated successfully.",
      updatedJournal
    );
  } catch (error) {
    console.error("Error updating journal:", error);
    return sendErrorResponse(
      res,
      "Something went wrong while updating the journal."
    );
  }
}

module.exports = updateJournal;
