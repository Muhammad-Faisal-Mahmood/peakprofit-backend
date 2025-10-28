const TradeJournal = require("../journal.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../shared/response.service");

// Create a new journal
async function createJournal(req, res) {
  try {
    const { title, content } = req.body;
    const userId = req.user.userId;

    if (!title || !content) {
      return sendErrorResponse(res, "Title and content are required.");
    }

    const newJournal = await TradeJournal.create({
      title,
      content,
      createdBy: userId,
    });

    return sendSuccessResponse(
      res,
      "Journal created successfully.",
      newJournal
    );
  } catch (error) {
    console.error("Error creating journal:", error);
    return sendErrorResponse(
      res,
      "Something went wrong while creating the journal."
    );
  }
}

module.exports = createJournal;
