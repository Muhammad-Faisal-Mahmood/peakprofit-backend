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
const getAllCommissions = require("./requests/getAllCommissions");
const getAllAffiliateWithdraws = require("./requests/getAllAffiliateWithdraws");
const getPayoutStats = require("./requests/getPayoutStats");
const updateWithdrawStatus = require("./requests/updateWithdrawStatus");
const { getCommissionStats } = require("./requests/getCommissionStats");
const giveUserTradingAccounts = require("./requests/giveUsersTradingAccounts");
const getUserDetails = require("./requests/getUserDetails");
const getTradingAccountDetails = require("./requests/getTradingAccountDetails");
const setUserStatus = require("./requests/setUserStatus");
const updateTradingAccountStatus = require("./requests/updateTradingAccountStatus");
const promoteDemoToLive = require("./requests/promoteDemoToLive");

router.get("/users", jwt, getAllUsers);
router.post("/users/give-account", jwt, giveUserTradingAccounts);
router.get("/users/:userId", jwt, getUserDetails);
router.get("/users/tradingAccount/:accountId", jwt, getTradingAccountDetails);
router.put("/users/tradingAccount/status", jwt, updateTradingAccountStatus);
router.post("/users/setStatus", jwt, setUserStatus);
router.post("/users/tradingAccount/promoteDemoToLive", jwt, promoteDemoToLive);
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
router.get("/commissions", jwt, getAllCommissions);
router.get("/affiliateWithdraws", jwt, getAllAffiliateWithdraws);
router.get("/payoutStats", jwt, getPayoutStats);
router.put("/updateWithdrawStatus/:withdrawId", jwt, updateWithdrawStatus);
router.get("/commissionStats", jwt, getCommissionStats);
router.get(
  "/kycApplications",
  jwt,
  require("./requests/getAllKYCApplications")
);
router.put(
  "/reviewKYCApplication/:kycId",
  jwt,
  require("./requests/reviewKYCApplication")
);

router.get("/tickets", jwt, require("./requests/getAllTickets"));
router.put("/updateTicket/:id", jwt, require("./requests/updateTicket"));
router.post("/ticketNote/:id", jwt, require("./requests/addTicketNote"));

module.exports = router;
