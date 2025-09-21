const mongoose = require("mongoose");

const ticketSchema = mongoose.Schema(
  {
    _id: mongoose.Schema.Types.ObjectId,
    category: {
      type: String,
      required: true,
      enum: ["technical", "billing", "general", "other"],
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    attachments: [
      {
        filename: String,
        originalName: String,
        path: String,
        size: Number,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    status: {
      type: String,
      enum: ["open", "in progress", "resolved", "closed"],
      default: "open",
    },

    internalNotes: [
      {
        admin: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        note: {
          type: String,
          required: true,
          maxlength: 1000,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    replies: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        isFromSupport: {
          type: Boolean,
          default: false,
        },
        message: {
          type: String,
          required: true,
          maxlength: 1000,
        },
        attachments: [
          {
            filename: String,
            originalName: String,
            path: String,
            size: Number,
          },
        ],
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent", "not assigned"],
      default: "not assigned",
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Ticket", ticketSchema);
