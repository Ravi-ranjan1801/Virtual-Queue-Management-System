const { User, Admin, USER_STATUS } = require("../models/User");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

let io;

const setIoInstance = (ioInstance) => {
  io = ioInstance;
};

// ─── Ticket Number Generator ───────────────────────────────────────────────
// Generates A001, A002... resets if count exceeds 999
// LLD: Single Responsibility — one function, one job
const generateTicketNumber = async (adminId) => {
  const count = await User.countDocuments({ admin: adminId });
  const number = (count + 1).toString().padStart(3, "0");
  return `A${number}`;
};

// ─── Recalculate positions + timeRemaining for all users in a queue ────────
// Called after: new user joins, user deleted, call-next
// LLD: extracted as utility — reused across multiple operations
const recalculateQueue = async (adminId) => {
  const admin = await Admin.findById(adminId);
  if (!admin) return;

  const users = await User.find({
    admin: adminId,
    status: { $in: [USER_STATUS.WAITING, USER_STATUS.CALLED] },
  }).sort({ createdAt: 1 });

  const timePerUser = (admin.delay || 10) * 60; // minutes → seconds

  const bulkOps = users.map((user, i) => ({
    updateOne: {
      filter: { _id: user._id },
      update: {
        $set: {
          position: i + 1,
          timeRemaining: i * timePerUser,
          // first person has 0 wait — they're being served
        },
      },
    },
  }));

  if (bulkOps.length > 0) await User.bulkWrite(bulkOps);

  // Return fresh data to emit via socket
  const updated = await User.find({
    admin: adminId,
  }).sort({ createdAt: 1 });

  return updated;
};

// ─── Register User ─────────────────────────────────────────────────────────
const registerUser = async (req, res) => {
  try {
    const { fullName, email, phone, admin } = req.body;

    // Validate admin ID
    if (!mongoose.Types.ObjectId.isValid(admin)) {
      return res.status(400).json({ error: "Invalid queue selected" });
    }

    // Check admin exists and queue is not full
    const adminDoc = await Admin.findById(admin);
    if (!adminDoc) {
      return res.status(404).json({ error: "Queue not found" });
    }

    // Fix: check email uniqueness per queue, not fullName globally
    const existingUser = await User.findOne({ email, admin });
    if (existingUser) {
      return res.status(400).json({
        error: "This email is already registered in this queue",
      });
    }

    // Generate ticket number
    const ticketNumber = await generateTicketNumber(admin);

    // Count current users for position
    const currentCount = await User.countDocuments({
      admin,
      status: { $in: [USER_STATUS.WAITING, USER_STATUS.CALLED] },
    });

    const timePerUser = (adminDoc.delay || 10) * 60; // seconds

    const userDoc = await User.create({
      fullName,
      email,
      phone,
      admin,
      ticketNumber,
      status: USER_STATUS.WAITING,
      position: currentCount + 1,
      timeRemaining: currentCount * timePerUser,
    });

    // Add user reference to admin
    await Admin.findByIdAndUpdate(admin, {
      $push: { users: userDoc._id },
    });

    // Emit to this queue's room only (LLD: targeted emit, not global)
    const updatedUsers = await recalculateQueue(admin);
    io.to(`queue_${admin}`).emit("queue-updated", updatedUsers);

    return res.status(200).json({ data: userDoc });

  } catch (e) {
    console.error("Registration failed:", e);
    res.status(500).json({ error: "Registration failed" });
  }
};

// ─── Login User ────────────────────────────────────────────────────────────
const loginUser = async (req, res) => {
  const { email } = req.body;

  try {
    const userDoc = await User.findOne({ email });
    if (!userDoc) {
      return res.status(400).json({ error: "No account found with this email" });
    }

    // Check if user is expired or completed
    if (
      userDoc.status === USER_STATUS.EXPIRED ||
      userDoc.status === USER_STATUS.COMPLETED
    ) {
      return res.status(400).json({
        error: "Your session has ended. Please register again.",
      });
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

// ─── Delete User ───────────────────────────────────────────────────────────
const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Recalculate queue positions after deletion
    const updatedUsers = await recalculateQueue(deletedUser.admin);

    // Emit to this queue's room only
    io.to(`queue_${deletedUser.admin}`).emit("queue-updated", updatedUsers);

    return res.status(200).json({
      message: "User deleted successfully",
      data: deletedUser,
    });

  } catch (e) {
    console.error("Delete failed:", e);
    res.status(500).json({ error: "Delete failed" });
  }
};

// ─── Voluntary Leave Queue ─────────────────────────────────────────────────
// Called when user clicks "Leave Queue" button on their dashboard
const leaveQueue = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Remove from admin's users array
    await Admin.findByIdAndUpdate(user.admin, {
      $pull: { users: user._id },
    });

    const updatedUsers = await recalculateQueue(user.admin);
    io.to(`queue_${user.admin}`).emit("queue-updated", updatedUsers);

    return res.status(200).json({ message: "Left queue successfully" });

  } catch (e) {
    console.error("Leave queue failed:", e);
    res.status(500).json({ error: "Failed to leave queue" });
  }
};

// ─── Update User ───────────────────────────────────────────────────────────
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { fullName, email, phone } = req.body;
  // Note: timeRemaining and status not editable directly from frontend form
  try {
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { fullName, email, phone },
      { new: true, runValidators: true }
    );
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    io.to(`queue_${updatedUser.admin}`).emit("user-updated", updatedUser);

    return res.status(200).json({
      message: "User updated successfully",
      data: updatedUser,
    });

  } catch (e) {
    console.error("Update failed:", e);
    res.status(500).json({ error: "Update failed" });
  }
};

// ─── Update User Status ────────────────────────────────────────────────────
// Called by admin: called → inService → completed/skipped
const updateUserStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!Object.values(USER_STATUS).includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // If completed or skipped, increment admin's totalServed
    if (
      status === USER_STATUS.COMPLETED ||
      status === USER_STATUS.SKIPPED
    ) {
      await Admin.findByIdAndUpdate(updatedUser.admin, {
        $inc: { totalServed: 1 },
      });
    }

    const updatedUsers = await recalculateQueue(updatedUser.admin);
    io.to(`queue_${updatedUser.admin}`).emit("queue-updated", updatedUsers);

    return res.status(200).json({
      message: "Status updated",
      data: updatedUser,
    });

  } catch (e) {
    console.error("Status update failed:", e);
    res.status(500).json({ error: "Status update failed" });
  }
};

// ─── Get Single User ───────────────────────────────────────────────────────
const getUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id).populate("admin", "fullName queueStatus delay start");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(200).json({ data: user });

  } catch (e) {
    console.error("Fetch user failed:", e);
    res.status(500).json({ error: "Failed to fetch user" });
  }
};

// ─── Confirm Presence ("I am here") ───────────────────────────────────────
const confirmPresence = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findByIdAndUpdate(
      id,
      { isPresent: true },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    io.to(`queue_${user.admin}`).emit("presence-confirmed", user);

    return res.status(200).json({ message: "Presence confirmed", data: user });

  } catch (e) {
    console.error("Presence confirmation failed:", e);
    res.status(500).json({ error: "Failed to confirm presence" });
  }
};

module.exports = {
  registerUser,
  loginUser,
  deleteUser,
  leaveQueue,
  updateUser,
  updateUserStatus,
  getUser,
  confirmPresence,
  setIoInstance,
  recalculateQueue,   // exported so index.js can use it in cron + call-next
};