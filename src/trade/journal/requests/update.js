const fs = require("fs");
const TradeJournal = require("../journal.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../../shared/response.service");

async function updateJournal(req, res) {
  try {
    const { id } = req.params;
    const { title, content, removeMedia = [] } = req.body;
    const userId = req.user.userId;

    // Check if the user provided *anything* to update
    const hasNewFiles = req.files && req.files.length > 0;
    const hasRemovals = Array.isArray(removeMedia) && removeMedia.length > 0;

    if (!title && !content && !hasNewFiles && !hasRemovals) {
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
    const newMedia = hasNewFiles ? req.files.map((file) => file.path) : [];

    // Step 2️⃣ — Handle removal of selected media files
    let updatedMedia = journal.media || [];

    if (hasRemovals) {
      updatedMedia = updatedMedia.filter((path) => !removeMedia.includes(path));

      // Delete the removed files from storage
      for (const filePath of removeMedia) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (err) {
          console.error("Error deleting file:", err);
        }
      }
    }

    // Step 3️⃣ — Merge old + new media
    updatedMedia = [...updatedMedia, ...newMedia];

    // Step 4️⃣ — Update only the provided fields
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
