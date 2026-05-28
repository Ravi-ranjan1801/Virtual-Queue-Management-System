const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName:     { type: String, required: true },
    email:        { type: String, required: true },
    phone:        { type: String, required: true },
    role:         { type: String, default: "User" },
    ticketNumber: { type: String, default: "" },
    position:     { type: Number, default: 0 },
    timeRemaining:{ type: Number, default: 0 },
    smsSent:      { type: Boolean, default: false },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      index: true,
    },
  },
  { timestamps: true }
);

const adminSchema = new mongoose.Schema(
  {
    fullName:    { type: String, required: true },
    email:       { type: String, required: true, unique: true },
    phone:       { type: String, required: true },
    role:        { type: String, default: "Admin" },
    password:    { type: String, required: true },
    start:       { type: Boolean, default: false },
    delay:       { type: Number, default: 10 },   // minutes per user
    queueStatus: {
      type: String,
      enum: ["notStarted", "active", "paused"],
      default: "notStarted",
    },
    pauseReason: { type: String, default: "" },
    totalServed: { type: Number, default: 0 },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

const User  = mongoose.model("User", userSchema);
const Admin = mongoose.model("Admin", adminSchema);

module.exports = { User, Admin };