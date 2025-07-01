const mongoose = require("mongoose");

const ReplySchema = mongoose.Schema(
  {
    email: { type: String, required: true },
    name: { type: String, required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

const contactSchema = mongoose.Schema(
  {
    email: { type: String, required: true },
    name: { type: String, required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["new", "viewed", "replied"],
      default: "new",
    },
    replies: [ReplySchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Contact", contactSchema);
