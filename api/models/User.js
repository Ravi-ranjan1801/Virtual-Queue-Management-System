const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: Number,
      required: true,
    },
    role: {
      type: String,
      default: "User",
    },
    timeRemaining: {
      type: Number,
    },
    smsSent: {
      type: Boolean,
      default: false,
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

const adminSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: Number,
      required: true,
    },
    role: {
      type: String,
      default: "Admin",
    },
    password: {
      type: String,
      required: true,
    },
    start: {
      type: Boolean,
      default: false,
    },
    delay: {
      type: Number,
      default: 10,
    },
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

const Admin = mongoose.model("Admin", adminSchema);

module.exports = { User, Admin };
