//  JSON Web Token
const JWT = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const user = JWT.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (error) {
    return res.status(400).json({
      code: 400,
      message: "Authentication Failed!",
    });
  }
};
