const express = require("express");
const router = express.Router();
const jwt = require("../../middleware/jwt");
const createJournal = require("./requests/create");
const getUserJournals = require("./requests/get");
const updateJournal = require("./requests/update");
const deleteJournal = require("./requests/delete");

// Create
router.post("/", jwt, createJournal);

// Get all for user
router.get("/", jwt, getUserJournals);

// Update
router.put("/:id", jwt, updateJournal);

// Delete
router.delete("/:id", jwt, deleteJournal);

module.exports = router;
