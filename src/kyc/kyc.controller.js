const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
// Import controllers
const submitKYCApplication = require("./requests/submitKYCApplication");
const getUserKYCStatus = require("./requests/getUserKYCStatus");

// Import middleware (assuming you have authentication middleware)
const jwt = require("../middleware/jwt");

// Multer configuration for file uploads
const uploadDir = "uploads/kyc/";

// Create directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  },
});

// Routes

// User routes
router.post(
  "/submit",
  jwt,
  upload.fields([
    { name: "idFrontImage", maxCount: 1 },
    { name: "idBackImage", maxCount: 1 },
  ]),
  submitKYCApplication
);

router.get("/status", jwt, getUserKYCStatus);

module.exports = router;
