const express = require("express");
const router = express.Router();
const jwt = require("../middleware/jwt");
const getAllUsers = require("./requests/getAllUsers");
const getSubscriptions = require("./requests/getSubscriptions");
const getAllContacts = require("./requests/getAllContacts");
const ContactSubmissionReply = require("./requests/contactSubmissionReply");

router.get("/users", jwt, getAllUsers);
router.get("/subscriptions", jwt, getSubscriptions);
router.get("/contacts", jwt, getAllContacts);
router.post("/contacts/:id/reply", jwt, ContactSubmissionReply);

module.exports = router;
