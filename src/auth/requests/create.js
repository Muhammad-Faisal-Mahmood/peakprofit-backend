const { sendErrorResponse } = require("../../shared/response.service");

module.exports = (req, res, next) => {
  const missingParams = [];
  const requiredParams = ["name", "email", "password"];

  // Check for the required parameters in req.body
  requiredParams.forEach((param) => {
    if (!req.body[param]) {
      missingParams.push(param);
    }
  });

  if (missingParams.length > 0) {
    return sendErrorResponse(
      res,
      `${missingParams.join(" and ")}: is required`
    );
  }

  next();
};
