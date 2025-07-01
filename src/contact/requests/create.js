const Contact = require("../contact.model");
const {
  sendSuccessResponse,
  sendErrorResponse,
} = require("../../shared/response.service");

const createContact = async (req, res) => {
  try {
    const { email, name, subject, message } = req.body;

    // Validate required fields
    if (!email || !name || !subject || !message) {
      return sendErrorResponse(
        res,
        "All fields are required: email, name, subject, message"
      );
    }

    const newContact = await Contact.create({
      email,
      name,
      subject,
      message,
    });

    return sendSuccessResponse(res, "Contact created successfully", newContact);
  } catch (error) {
    return sendErrorResponse(res, `Error creating contact: ${error.message}`);
  }
};

module.exports = createContact;
