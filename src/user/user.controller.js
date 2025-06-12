const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

// Middlewares
const jwt = require("../middleware/jwt.js");
const role = require("../middleware/role.js");
const getUser = require("./requests/get.js");
const updateUser = require("./requests/update.js");

// Response Helpers
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../shared/response.service");

const multer = require("multer");

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "../uploads/user");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up storage for uploaded files
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

// File filter to only allow images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

router.get("/get-user", jwt, getUser);
router.put("/update-user", jwt, upload.single("profilePicture"), updateUser);

module.exports = router;

// router.get("/show/:id", jwt, role(['Admin']), async (req, res, next) => {
//
// 	try {
// 		let id = req.params.id;
// 		let user = await UserService.findById(id);
// 		return sendSuccessResponse(res, "Request Successful", user);
//
// 	} catch (error) {
// 		return sendErrorResponse(res, "Internal server error");
// 	}
// });
//
// router.get("/mark-verified/:id", jwt, role(['Admin']), async (req, res, next) => {
//
// 	try {
// 		let id = req.params.id;
// 		let user = await UserService.update({ _id: id }, { isVerified: true });
//
// 		return sendSuccessResponse(res, "Request Successful", user);
//
// 	} catch (error) {
// 		return sendErrorResponse(res, "Internal server error");
// 	}
// });
//
// router.get("/mark-unverified/:id", jwt, role(['Admin']), async (req, res, next) => {
//
// 	try {
// 		let id = req.params.id;
// 		let user = await UserService.update({ _id: id }, { isVerified: false });
//
// 		return sendSuccessResponse(res, "Request Successful", user);
//
// 	} catch (error) {
// 		return sendErrorResponse(res, "Internal server error");
// 	}
// });
//
// router.get("/mark-paid/:id", jwt, role(['Admin']), async (req, res, next) => {
//
// 	try {
// 		let id = req.params.id;
// 		let user = await UserService.update({ _id: id }, { subscription: "Manual Subscribed By Admin" });
//
// 		return sendSuccessResponse(res, "Request Successful", user);
//
// 	} catch (error) {
// 		return sendErrorResponse(res, "Internal server error");
// 	}
// });
//
// router.get("/mark-unpaid/:id", jwt, role(['Admin']), async (req, res, next) => {
//
// 	try {
// 		let id = req.params.id;
// 		let user = await UserService.update({ _id: id }, { subscription: "Manual Subscribed By Admin" });
//
// 		return sendSuccessResponse(res, "Request Successful", user);
//
// 	} catch (error) {
// 		return sendErrorResponse(res, "Internal server error");
// 	}
// });
//
// router.get("/list", jwt, role(['Admin']), async (req, res, next) => {
//
// 	try {
// 		let request = req.query;
// 		let pageNo = request.pageNo ? request.pageNo : 1;
// 		let search = request.search ? request.search : null;
// 		let users = await UserService.list(pageNo, search);
// 		return sendSuccessResponse(res, "Request Successful", users);
// 	} catch (error) {
// 		return sendErrorResponse(res, "Internal server error");
// 	}
// });
//
// router.delete("/:id", jwt, role(['Admin']), async (req, res, next) => {
//
// 	try {
// 		let id = req.params.id;
// 		await UserService.delete(id);
// 		return sendSuccessResponse(res, "Request Successful");
// 	} catch (error) {
// 		return sendErrorResponse(res, "Internal server error");
// 	}
// });
//
// router.get("/report", jwt, role(['Admin']), async (req, res, next) => {
// 	try {
// 		let { startDate, endDate } = req.query;
//
// 		if (!startDate || !endDate) {
// 			return sendErrorResponse(res, "Start date and end date are required");
// 		}
//
// 		let report = await UserService.generateReport(startDate, endDate);
// 		return sendSuccessResponse(res, "Request Successful", report);
//
// 	} catch (error) {
// 		return sendErrorResponse(res, "Internal server error");
// 	}
// });
