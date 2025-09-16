const express = require("express");
const router = express.Router();
const apply = require("./requests/apply");
const jwt = require("../middleware/jwt");
const { getAffiliateProfile } = require("./requests/get");
const { stats } = require("./requests/stats");
const {
  getAffiliateCommissionHistory,
} = require("./requests/getAffiliateCommissionHistory");
const { tierDetails } = require("./requests/tierDetails");

router.post("/apply", apply);
router.get("/profile", jwt, getAffiliateProfile);
router.get("/stats", jwt, stats);
router.get("/commissionHistory", jwt, getAffiliateCommissionHistory);
router.get("/tierDetails", jwt, tierDetails);

module.exports = router;
