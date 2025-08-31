const express = require("express");
const router = express.Router();
const jwt = require("../middleware/jwt");
const getAllUsers = require("./requests/getAllUsers");
const getSubscriptions = require("./requests/getSubscriptions");
const getAllContacts = require("./requests/getAllContacts");
const ContactSubmissionReply = require("./requests/contactSubmissionReply");
const getAllAffiliateApplications = require("./requests/getAllAffiliateApplications");
const updateAffiliateApplicationStatus = require("./requests/updateAffiliateApplicationStatus");
const updatePlatinumAffiliateCommission = require("./requests/updatePlatinumAffiliateCommission");
const getAllAffiliates = require("./requests/getAllAffiliates");
router.get("/users", jwt, getAllUsers);
router.get("/subscriptions", jwt, getSubscriptions);
router.get("/contacts", jwt, getAllContacts);
router.post("/contacts/:id/reply", jwt, ContactSubmissionReply);
router.get("/affiliateApplications", jwt, getAllAffiliateApplications);
router.put(
  "/affiliateApplication/:applicationId",
  jwt,
  updateAffiliateApplicationStatus
);
router.put(
  "/platinumAffiliate/:affiliateId",
  jwt,
  updatePlatinumAffiliateCommission
);

router.get("/affiliates", jwt, getAllAffiliates);

module.exports = router;
