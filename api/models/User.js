const mongoose = require("mongoose");

// User status flow (LLD: State Machine pattern)
// waiting → called → inService → completed
//                  ↘ skipped (if no response)
//                              ↘ expired (timer hits 0)
const USER_STATUS = {
  WAITING: "waiting",
  CALLED: "called",
  IN_SERVICE: "inService",
  SKIPPED: "skipped",
  COMPLETED: "completed",
  EXPIRED: "expired",
};

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      validate: {
        validator: (v) => /^\d{10}$/.test(v),
        message: "Phone must be exactly 10 digits",
      },
    },
    role: {
      type: String,
      default: "User",
    },
    ticketNumber: {
      type: String,      // e.g. "A001", "A002"
      default: "",
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.WAITING,
    },
    timeRemaining: {
      type: Number,
      default: 0,
    },
    position: {
      type: Number,
      default: 0,
    },
    smsSent: {
      type: Boolean,
      default: false,
    },
    isPresent: {
      type: Boolean,    // for "I am here" confirmation
      default: false,
    },
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
    fullName: {
      type: String,
      required: [true, "Full name is required"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      validate: {
        validator: (v) => /^\d{10}$/.test(v),
        message: "Phone must be exactly 10 digits",
      },
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
      default: 10,     // default 10 mins per user as you wanted
    },
    queueStatus: {
      type: String,
      enum: ["notStarted", "active", "paused"],
      default: "notStarted",
    },
    pauseReason: {
      type: String,
      default: "",
    },
    totalServed: {
      type: Number,
      default: 0,      // for analytics
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

const User = mongoose.model("User", userSchema);
const Admin = mongoose.model("Admin", adminSchema);

module.exports = { User, Admin, USER_STATUS };