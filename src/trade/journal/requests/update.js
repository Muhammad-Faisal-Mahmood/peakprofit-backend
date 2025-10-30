const fs = require("fs");
const TradeJournal = require("../journal.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../shared/response.service");

async function updateJournal(req, res) {
  try {
    const { id } = req.params;
    const { title, content, removeMedia } = req.body; // removeMedia is now a string
    const userId = req.user.userId;

    // Check if any field or media was updated
    const hasNewFiles = req.files && req.files.length > 0;
    const hasRemoval = !!removeMedia && typeof removeMedia === "string";

    if (!title && !content && !hasNewFiles && !hasRemoval) {
      return sendErrorResponse(
        res,
        "Please provide at least one field or media change to update."
      );
    }

    // Find the journal
    const journal = await TradeJournal.findOne({ _id: id, createdBy: userId });
    if (!journal) {
      return sendErrorResponse(res, "Journal not found or not authorized.");
    }

    // Step 1️⃣ — Handle new media uploads
    const newMedia = hasNewFiles
      ? req.files.map((file) => process.env.BACKEND_URL + "/" + file.path)
      : [];

    // Step 2️⃣ — Handle single media removal
    let updatedMedia = journal.media || [];

    if (hasRemoval) {
      updatedMedia = updatedMedia.filter((path) => path !== removeMedia);

      // Delete the removed file from storage
      try {
        if (fs.existsSync(removeMedia)) {
          fs.unlinkSync(removeMedia);
        }
      } catch (err) {
        console.error("Error deleting file:", err);
      }
    }

    // Step 3️⃣ — Merge remaining + new media
    updatedMedia = [...updatedMedia, ...newMedia];

    // Step 4️⃣ — Update only provided fields
    if (title) journal.title = title;
    if (content) journal.content = content;
    journal.media = updatedMedia;

    await journal.save();

    return sendSuccessResponse(res, "Journal updated successfully.", journal);
  } catch (error) {
    console.error("Error updating journal:", error);
    return sendErrorResponse(
      res,
      "Something went wrong while updating the journal."
    );
  }
}

module.exports = updateJournal;
