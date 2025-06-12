const ResponseCode = require("../shared/ResponseCode");

function sendErrorResponse(res, message) {
  result = {
    message: message,
  };
  return res.status(ResponseCode.NOT_SUCCESS).json(result);
}

function sendSuccessResponse(res, message, result = null) {
  result = {
    result: result,
    message: message,
  };
  return res.status(ResponseCode.SUCCESS).json(result);
}

module.exports = { sendSuccessResponse, sendErrorResponse };
