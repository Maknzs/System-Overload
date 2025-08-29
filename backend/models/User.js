const { Schema, model } = require("mongoose");

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, trim: true },
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    gamesPlayed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = model("User", UserSchema);
