const express = require("express");
const router = express.Router();
const apply = require("./requests/apply");
const jwt = require("../middleware/jwt");
const { getAffiliateProfile } = require("./requests/get");

router.post("/apply", apply);
router.get("/profile", jwt, getAffiliateProfile);

module.exports = router;
