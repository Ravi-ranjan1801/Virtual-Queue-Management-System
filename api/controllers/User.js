const { User, Admin } = require("../models/User");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

let io;
const setIoInstance = (ioInstance) => { io = ioInstance; };

// ── Core queue recalculation ───────────────────────────────────────────────
// Called after: user joins, user deleted, admin pops, time changes
// LLD: Single function, single responsibility — all queue math lives here
const recalculateQueue = async (adminId) => {
  const admin = await Admin.findById(adminId);
  if (!admin) return [];

  const timePerUser = (admin.delay || 10) * 60; // minutes → seconds
  const users = await User.find({ admin: adminId }).sort({ createdAt: 1 });

  // Fix: (i+1) not i — position 1 gets 1*time, NOT 0
  // i=0 (position 1, being served): timeRemaining = 1 * timePerUser
  // i=1 (position 2, next up):      timeRemaining = 2 * timePerUser
  const bulkOps = users.map((user, i) => ({
    updateOne: {
      filter: { _id: user._id },
      update: {
        $set: {
          position: i + 1,
          timeRemaining: (i + 1) * timePerUser,
        },
      },
    },
  }));

  if (bulkOps.length > 0) await User.bulkWrite(bulkOps);

  // Return fresh data with updated values
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

    // One email per queue only
    const existing = await User.findOne({ email, admin });
    if (existing) {
      return res.status(400).json({
        error: "This email is already registered in this queue",
      });
    }

    // Ticket number: A001, A002... based on total ever joined this queue
    const count = await User.countDocuments({ admin });
    const ticketNumber = `A${(count + 1).toString().padStart(3, "0")}`;

    const userDoc = await User.create({
      fullName, email, phone, admin, ticketNumber,
    });

    await Admin.findByIdAndUpdate(admin, { $push: { users: userDoc._id } });

    // Recalculate everyone's position and time after new join
    const updatedUsers = await recalculateQueue(admin);
    io.to(`queue_${admin}`).emit("queue-updated", updatedUsers);

    // Find the newly created user with updated position/timeRemaining
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
  leaveQueue, getUser, setIoInstance, recalculateQueue,
};