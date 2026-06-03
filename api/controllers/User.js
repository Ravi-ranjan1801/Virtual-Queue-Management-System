const { User, Admin } = require("../models/User");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

let io;
const setIoInstance = (ioInstance) => { io = ioInstance; };

// ── Core queue recalculation ───────────────────────────────────────────────
// Called after: user joins, user deleted, admin pops, time changes
// LLD: Single Responsibility — position logic separated from timer logic
// Called on POP and DELETE — full timer reset for everyone
const recalculateQueue = async (adminId) => {
  const admin = await Admin.findById(adminId);
  if (!admin) return [];
  const timePerUser = (admin.delay || 10) * 60;
  const users = await User.find({ admin: adminId }).sort({ createdAt: 1 });

  const bulkOps = users.map((user, i) => ({
    updateOne: {
      filter: { _id: user._id },
      update: {
        $set: {
          position: i + 1,
          timeRemaining: i * timePerUser, // P1=0, P2=delay, P3=2×delay
        },
      },
    },
  }));

  if (bulkOps.length > 0) await User.bulkWrite(bulkOps);
  return await User.find({ admin: adminId }).sort({ createdAt: 1 });
};

// Called on JOIN only — positions only, timers untouched
const recalculatePositions = async (adminId) => {
  const users = await User.find({ admin: adminId }).sort({ createdAt: 1 });

  const bulkOps = users.map((user, i) => ({
    updateOne: {
      filter: { _id: user._id },
      update: { $set: { position: i + 1 } },
    },
  }));

  if (bulkOps.length > 0) await User.bulkWrite(bulkOps);
  return await User.find({ admin: adminId }).sort({ createdAt: 1 });
};

// Full reset — ONLY used when admin changes delay
// Recalculates all timers from scratch based on position
const fullResetTimers = async (adminId, timePerUser) => {
  const users = await User.find({ admin: adminId }).sort({ createdAt: 1 });

  const bulkOps = users.map((user, i) => ({
    updateOne: {
      filter: { _id: user._id },
      update: {
        $set: {
          position: i + 1,
          timeRemaining: i * timePerUser,
        },
      },
    },
  }));

  if (bulkOps.length > 0) await User.bulkWrite(bulkOps);

  return await User.find({ admin: adminId }).sort({ createdAt: 1 });
};
// ── Register user ──────────────────────────────────────────────────────────
const registerUser = async (req, res) => {
  try {
    const { fullName, email, phone, admin } = req.body;

    if (!mongoose.Types.ObjectId.isValid(admin)) {
      return res.status(400).json({ error: "Invalid queue selected" });
    }

    const adminDoc = await Admin.findById(admin);
    if (!adminDoc) {
      return res.status(404).json({ error: "Queue not found" });
    }

    const existing = await User.findOne({ email, admin });
    if (existing) {
      return res.status(400).json({
        error: "This email is already registered in this queue",
      });
    }

    // Ticket number — atomic, never resets
    const updatedAdmin = await Admin.findByIdAndUpdate(
      admin,
      { $inc: { ticketCounter: 1 } },
      { new: true }
    );
    const ticketNumber = `A${updatedAdmin.ticketCounter.toString().padStart(3, "0")}`;

    const timePerUser = (adminDoc.delay || 10) * 60; // minutes → seconds

    // Fix: get last user's CURRENT timeRemaining — not based on position
    // New user waits = last person's current wait + one serving slot
    const lastUser = await User.findOne({ admin }).sort({ createdAt: -1 });
    const newTimeRemaining = lastUser
      ? lastUser.timeRemaining + timePerUser
      : 0; // first user → position 1 → being served immediately

    const userDoc = await User.create({
      fullName, email, phone, admin,
      ticketNumber,
      timeRemaining: newTimeRemaining,
    });

    await Admin.findByIdAndUpdate(admin, { $push: { users: userDoc._id } });

    // Update positions only — existing timers untouched
    const updatedUsers = await recalculatePositions(admin);
    io.to(`queue_${admin}`).emit("queue-updated", updatedUsers);

    const updatedUser = updatedUsers.find(
      (u) => u._id.toString() === userDoc._id.toString()
    );

    return res.status(200).json({ data: updatedUser || userDoc });

  } catch (e) {
    console.error("Registration failed:", e);
    res.status(500).json({ error: "Registration failed" });
  }
};

// ── Login user ─────────────────────────────────────────────────────────────
const loginUser = async (req, res) => {
  try {
    const { email } = req.body;
    const userDoc = await User.findOne({ email })
      .populate("admin", "fullName queueStatus delay start pauseReason");

    if (!userDoc) {
      return res.status(400).json({ error: "No account found with this email" });
    }

    const token = jwt.sign(
      { email, id: userDoc._id, role: userDoc.role },
      process.env.SECRET_KEY,
      { expiresIn: "24h" }
    );

    res.cookie("usertoken", token, { httpOnly: true }).json({
      message: "Login Successful",
      data: userDoc,
      token,
    });

  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ── Delete user (by admin) ─────────────────────────────────────────────────
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    await Admin.findByIdAndUpdate(deletedUser.admin, {
      $pull: { users: deletedUser._id },
    });

    // Recalculate queue after deletion
    const updatedUsers = await recalculateQueue(deletedUser.admin);
    io.to(`queue_${deletedUser.admin}`).emit("queue-updated", updatedUsers);

    return res.status(200).json({ message: "User deleted", data: deletedUser });

  } catch (e) {
    console.error("Delete failed:", e);
    res.status(500).json({ error: "Delete failed" });
  }
};

// ── Voluntary leave queue ──────────────────────────────────────────────────
const leaveQueue = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    await Admin.findByIdAndUpdate(user.admin, { $pull: { users: user._id } });

    const updatedUsers = await recalculateQueue(user.admin);
    io.to(`queue_${user.admin}`).emit("queue-updated", updatedUsers);

    return res.status(200).json({ message: "Left queue successfully" });

  } catch (e) {
    console.error("Leave queue failed:", e);
    res.status(500).json({ error: "Failed to leave queue" });
  }
};

// ── Get single user ────────────────────────────────────────────────────────
const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("admin", "fullName queueStatus delay start pauseReason");
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.status(200).json({ data: user });
  } catch (e) {
    console.error("Fetch user failed:", e);
    res.status(500).json({ error: "Failed to fetch user" });
  }
};

module.exports = {
  registerUser, loginUser, deleteUser,
  leaveQueue, getUser, setIoInstance,
  recalculateQueue,      // used by Admin.js (pop, delete)
  recalculatePositions,  // used by registerUser (join)
};