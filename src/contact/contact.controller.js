const express = require("express");
const router = express.Router();
const jwt = require("../middleware/jwt");
const createContact = require("./requests/create");
const updateStatus = require("./requests/updateStatus");

// Public route - no authentication required
router.post("/", createContact);

// Admin routes - require authentication
router.put("/:id/status", jwt, updateStatus);

module.exports = router;
