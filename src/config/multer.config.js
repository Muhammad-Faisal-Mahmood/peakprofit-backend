const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Function to create multer configuration
const createMulterConfig = (folderName) => {
  // Define allowed file types
  const allowedFileTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;

  // Create storage configuration
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      // Create directory if it doesn't exist
      const dir = `uploads/${folderName}`;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: function (req, file, cb) {
      // Create unique filename with timestamp
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(
        null,
        file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
      );
    },
  });

  // File filter function
  const fileFilter = (req, file, cb) => {
    const extname = allowedFileTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedFileTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Error: File type not supported!"));
    }
  };

  // Create and return multer instance
  return multer({
    storage: storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
      files: 5, // Maximum of 5 files
    },
    fileFilter: fileFilter,
  });
};

module.exports = createMulterConfig;
