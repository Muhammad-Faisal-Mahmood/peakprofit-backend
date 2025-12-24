//  JSON Web Token
const JWT = require("jsonwebtoken");
const { isUserInactive } = require("../utils/redis.helper");
module.exports = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const user = JWT.verify(token, process.env.JWT_SECRET);
    req.user = user;
    const inactive = await isUserInactive(user.userId);
    if (inactive) {
      return res.status(403).json({
        code: 403,
        message: "User account is not active.",
      });
    }
    next();
  } catch (error) {
    return res.status(400).json({
      code: 400,
      message: "Authentication Failed!",
    });
  }
};
