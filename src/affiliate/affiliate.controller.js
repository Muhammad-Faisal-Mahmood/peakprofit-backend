const express = require("express");
const router = express.Router();
const jwt = require("../middleware/jwt");
const jsonwebtoken = require("jsonwebtoken");
const apply = require("./requests/apply");

router.post("/apply", apply);

module.exports = router;
