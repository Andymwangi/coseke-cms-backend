const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    role: { type: String, default: "staff" },
    password: { type: String, required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant" },
    resetPasswordToken: String,
    resetPasswordExpires: Date
  },
  {
    timestamps: true, // Adds `createdAt` and `updatedAt` fields
  }
);

module.exports = mongoose.model("User", userSchema);
