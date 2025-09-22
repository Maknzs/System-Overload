const { Schema, model } = require("mongoose");

const FeedbackSchema = new Schema(
  {
    email: { type: String, trim: true },
    message: { type: String, required: true, trim: true },
    players: {
      type: [String],
      default: [],
    },
    meta: {
      ip: { type: String },
      userAgent: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = model("Feedback", FeedbackSchema);
