const jsonwebtoken = require("jsonwebtoken");
const AffiliateApplication = require("../affiliateApplication.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

const apply = async (req, res) => {
  try {
    let { name, email, strategy, socialMediaLink, websiteLink } = req.body;
    let userId = null;

    // Check if token is provided
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.split(" ")[1];
        const decoded = jsonwebtoken.verify(token, process.env.JWT_SECRET);

        // Overwrite with token data
        name = decoded.name;
        email = decoded.email;
        userId = decoded.userId; // store reference to the user
      } catch (err) {
        console.warn("Invalid token:", err.message);
        // don’t stop request, just continue with body data
      }
    }

    // Validate required fields
    if (!name || !email || !strategy || !socialMediaLink || !websiteLink) {
      return sendErrorResponse(res, "All fields are required");
    }

    // Create application (status defaults to "pending")
    const application = new AffiliateApplication({
      userId,
      name,
      email,
      strategy,
      socialMediaLink,
      websiteLink,
    });

    await application.save();

    return sendSuccessResponse(
      res,
      "Application submitted successfully",
      application
    );
  } catch (err) {
    if (err.code === 11000) {
      return sendErrorResponse(
        res,
        "Application with this email already exists"
      );
    }
    console.error(err);
    return sendErrorResponse(res, "Server error");
  }
};

module.exports = apply;
