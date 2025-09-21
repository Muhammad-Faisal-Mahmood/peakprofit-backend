// routes.js
const express = require("express");
const router = express.Router();
const createTicket = require("./requests/createTicket");
const getUserTickets = require("./requests/getUserTickets");
const getTicketById = require("./requests/getTicketById");
const addReply = require("./requests/addReply");
const createMulterConfig = require("../config/multer.config");
const jwt = require("../middleware/jwt");

// Initialize multer for ticket attachments
const upload = createMulterConfig("tickets");
const replyUpload = createMulterConfig("tickets/replies");

// Create a new ticket
router.post("/create", jwt, upload.array("attachments", 5), createTicket);

// Get all tickets for the authenticated user
router.get("/", jwt, getUserTickets);

// Get a specific ticket by ID
router.get("/:id", jwt, getTicketById);

// Add a reply to a ticket
router.post("/:id/reply", jwt, replyUpload.array("attachments", 3), addReply);

module.exports = router;
