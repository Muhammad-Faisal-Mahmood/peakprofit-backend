const crypto = require("crypto");

function generateInvoiceNumber() {
  return crypto
    .randomBytes(16) // 128 bits
    .toString("base64url") // alphanumeric + - _
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 20)
    .toUpperCase();
}

module.exports = generateInvoiceNumber;
