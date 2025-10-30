const express = require("express");
const router = express.Router();
const jwt = require("../../middleware/jwt");
const createJournal = require("./requests/create");
const getUserJournals = require("./requests/get");
const updateJournal = require("./requests/update");
const deleteJournal = require("./requests/delete");
const createMulterConfig = require("../../config/multer.config");

const upload = createMulterConfig("journal-media");
// Create
router.post("/", jwt, upload.array("media", 5), createJournal);

// Get all for user
router.get("/", jwt, getUserJournals);

// Update
router.put("/:id", jwt, upload.array("media", 5), updateJournal);

// Delete
router.delete("/:id", jwt, deleteJournal);

module.exports = router;
