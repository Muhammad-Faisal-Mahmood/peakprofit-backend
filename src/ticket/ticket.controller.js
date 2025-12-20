// routes.js
const express = require("express");
const router = express.Router();
const createTicket = require("./requests/createTicket");
const getUserTickets = require("./requests/getUserTickets");
const getTicketById = require("./requests/getTicketById");
const addReply = require("./requests/addReply");
const createMulterConfig = require("../config/multer.config");
const jwt = require("../middleware/jwt");
const tokenParser = require("../middleware/tokenParser");

// Initialize multer for ticket attachments
const upload = createMulterConfig("tickets");
const replyUpload = createMulterConfig("tickets/replies");

// Create a new ticket
router.post(
  "/create",
  tokenParser,
  upload.array("attachments", 5),
  createTicket
);

// Get all tickets for the authenticated user
router.get("/", tokenParser, getUserTickets);

// Get a specific ticket by ID
router.get("/:id", tokenParser, getTicketById);

// Add a reply to a ticket
router.post(
  "/:id/reply",
  tokenParser,
  replyUpload.array("attachments", 3),
  addReply
);

module.exports = router;
