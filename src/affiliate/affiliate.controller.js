const express = require("express");
const router = express.Router();
const apply = require("./requests/apply");

router.post("/apply", apply);

module.exports = router;
