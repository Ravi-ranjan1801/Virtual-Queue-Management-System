const { User, Admin, USER_STATUS } = require("../models/User");
const { recalculateQueue } = require("./User");
const bcryptjs = require("bcryptjs");
const salt = bcryptjs.genSaltSync(10);
const jwt = require("jsonwebtoken");

let io;

const setIoInstance = (ioInstance) => {
  io = ioInstance;
};

// ─── Register Admin ────────────────────────────────────────────────────────
const registerAdmin = async (req, res) => {
  try {
    const { fullName, email, phone, password, adminSecret } = req.body;

    // Secret code check — prevents random people registering as admin
    // Set ADMIN_SECRET_CODE=yourcode in your .env file
    if (adminSecret !== process.env.ADMIN_SECRET_CODE) {
      return res.status(403).json({
        error: "Invalid admin secret code",
      });
    }

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const adminDoc = await Admin.create({
      fullName,
      email,
      phone,
      password: bcryptjs.hashSync(password, salt),
      role: "Admin",
      start: false,
      queueStatus: "notStarted",
      delay: 10, // default 10 mins per user
    });

    // Admin gets their own JWT too for immediate login after register
    const token = jwt.sign(
      { email, id: adminDoc._id, role: adminDoc.role },
      process.env.SECRET_KEY,
      { expiresIn: "24h" }
    );

    io.emit("admin-updated", adminDoc);

    return res.status(200).json({ data: adminDoc, token });

  } catch (e) {
    console.error("Admin registration failed:", e);
    res.status(500).json({ error: "Registration failed" });
  }
};

// ─── Login Admin ───────────────────────────────────────────────────────────
const loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const adminDoc = await Admin.findOne({ email });
    if (!adminDoc) {
      return res.status(400).json({ error: "No admin found with this email" });
    }

    const passOk = await bcryptjs.compare(password, adminDoc.password);
    if (!passOk) {
      return res.status(401).json({ error: "Wrong password" });
    }

    const token = jwt.sign(
      { email, id: adminDoc._id, role: adminDoc.role },
      process.env.SECRET_KEY,
      { expiresIn: "24h" }
    );

    res.cookie("admintoken", token, { httpOnly: true }).json({
      message: "Login Successful",
      data: adminDoc,
      token,
    });

  } catch (e) {
    console.error("Admin login error:", e);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ─── Get All Users for Admin ───────────────────────────────────────────────
// Fix: no longer overwrites timeRemaining on every fetch
// Just reads current state from DB
const getAllUsers = async (req, res) => {
  try {
    const { adminId } = req.params;
    const admin = await Admin.findById(adminId);

    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    const allUsers = await User.find({ admin: adminId }).sort({ createdAt: 1 });

    return res.status(200).json({
      message: "Dashboard data fetched",
      data: admin,
      user: allUsers,
    });

  } catch (e) {
    console.error("Error in getAllUsers:", e);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ─── Call Next User ────────────────────────────────────────────────────────
// Admin manually calls next — marks current in-service as completed,
// next waiting user becomes called, then inService
const callNextUser = async (req, res) => {
  const { adminId } = req.params;
  try {
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    // Mark current inService user as completed
    const currentUser = await User.findOne({
      admin: adminId,
      status: USER_STATUS.IN_SERVICE,
    });

    if (currentUser) {
      currentUser.status = USER_STATUS.COMPLETED;
      await currentUser.save();

      // Increment analytics counter
      await Admin.findByIdAndUpdate(adminId, {
        $inc: { totalServed: 1 },
      });
    }

    // Find next waiting user (earliest join time)
    const nextUser = await User.findOne({
      admin: adminId,
      status: USER_STATUS.WAITING,
    }).sort({ createdAt: 1 });

    if (!nextUser) {
      // Queue is empty
      const updatedUsers = await recalculateQueue(adminId);
      io.to(`queue_${adminId}`).emit("queue-updated", updatedUsers);
      return res.status(200).json({ message: "Queue is empty", data: null });
    }

    // Mark next user as called — they get 60 seconds to confirm presence
    nextUser.status = USER_STATUS.CALLED;
    await nextUser.save();

    // Notify that specific user's room
    io.to(`queue_${adminId}`).emit("user-called", {
      userId: nextUser._id,
      ticketNumber: nextUser.ticketNumber,
      name: nextUser.fullName,
    });

    // After 60 seconds, if not confirmed → mark skipped, call next
    setTimeout(async () => {
      const recheckUser = await User.findById(nextUser._id);
      if (recheckUser && recheckUser.status === USER_STATUS.CALLED && !recheckUser.isPresent) {
        recheckUser.status = USER_STATUS.SKIPPED;
        await recheckUser.save();

        await Admin.findByIdAndUpdate(adminId, {
          $inc: { totalServed: 1 },
        });

        // Notify queue about skip
        io.to(`queue_${adminId}`).emit("user-skipped", {
          userId: recheckUser._id,
          ticketNumber: recheckUser.ticketNumber,
        });

        // Auto call next after skip
        const afterSkip = await User.findOne({
          admin: adminId,
          status: USER_STATUS.WAITING,
        }).sort({ createdAt: 1 });

        if (afterSkip) {
          afterSkip.status = USER_STATUS.IN_SERVICE;
          await afterSkip.save();
        }

        const updatedUsers = await recalculateQueue(adminId);
        io.to(`queue_${adminId}`).emit("queue-updated", updatedUsers);
      } else if (recheckUser && recheckUser.status === USER_STATUS.CALLED) {
        // User confirmed — move to inService
        recheckUser.status = USER_STATUS.IN_SERVICE;
        await recheckUser.save();

        const updatedUsers = await recalculateQueue(adminId);
        io.to(`queue_${adminId}`).emit("queue-updated", updatedUsers);
      }
    }, 60000); // 60 seconds to confirm

    const updatedUsers = await recalculateQueue(adminId);
    io.to(`queue_${adminId}`).emit("queue-updated", updatedUsers);

    return res.status(200).json({
      message: "Next user called",
      data: nextUser,
    });

  } catch (e) {
    console.error("Call next failed:", e);
    res.status(500).json({ error: "Failed to call next user" });
  }
};

// ─── Get Analytics ─────────────────────────────────────────────────────────
const getAnalytics = async (req, res) => {
  const { adminId } = req.params;
  try {
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));

    // All users who joined today
    const todayUsers = await User.find({
      admin: adminId,
      createdAt: { $gte: todayStart },
    });

    const totalToday = todayUsers.length;
    const completedToday = todayUsers.filter(
      (u) => u.status === USER_STATUS.COMPLETED
    ).length;
    const skippedToday = todayUsers.filter(
      (u) => u.status === USER_STATUS.SKIPPED
    ).length;
    const currentlyWaiting = await User.countDocuments({
      admin: adminId,
      status: USER_STATUS.WAITING,
    });

    // Average wait time = avg position * delay
    const avgWaitTime = admin.delay * (currentlyWaiting / 2);

    return res.status(200).json({
      data: {
        totalServed: admin.totalServed,
        totalToday,
        completedToday,
        skippedToday,
        currentlyWaiting,
        avgWaitTimeMinutes: Math.round(avgWaitTime),
        avgServingTimeMinutes: admin.delay,
      },
    });

  } catch (e) {
    console.error("Analytics fetch failed:", e);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
};

// ─── Update Queue Status (pause/resume) ───────────────────────────────────
const updateQueueStatus = async (req, res) => {
  const { adminId } = req.params;
  const { queueStatus, pauseReason } = req.body;

  const validStatuses = ["notStarted", "active", "paused"];
  if (!validStatuses.includes(queueStatus)) {
    return res.status(400).json({ error: "Invalid queue status" });
  }

  try {
    const admin = await Admin.findByIdAndUpdate(
      adminId,
      {
        queueStatus,
        pauseReason: queueStatus === "paused" ? pauseReason : "",
        start: queueStatus === "active",
      },
      { new: true }
    );

    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    // Notify all users in this queue about status change
    io.to(`queue_${adminId}`).emit("queue-status-changed", {
      queueStatus,
      pauseReason: admin.pauseReason,
    });

    return res.status(200).json({
      message: "Queue status updated",
      data: admin,
    });

  } catch (e) {
    console.error("Queue status update failed:", e);
    res.status(500).json({ error: "Failed to update queue status" });
  }
};

// ─── Delete Admin ──────────────────────────────────────────────────────────
const deleteAdmin = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedAdmin = await Admin.findByIdAndDelete(id);
    if (!deletedAdmin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    // Delete all users in this admin's queue
    await User.deleteMany({ admin: id });

    io.emit("admin-deleted", deletedAdmin);

    return res.status(200).json({
      message: "Admin and all associated users deleted",
      data: deletedAdmin,
    });

  } catch (e) {
    console.error("Admin delete failed:", e);
    res.status(400).json({ error: "Delete failed" });
  }
};

// ─── Update Admin Profile ──────────────────────────────────────────────────
const updateAdmin = async (req, res) => {
  const { adminId } = req.params;
  const { fullName, email, phone } = req.body;
  try {
    const updatedAdmin = await Admin.findByIdAndUpdate(
      adminId,
      { fullName, email, phone },
      { new: true, runValidators: true }
    );
    if (!updatedAdmin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    io.emit("admin-updated", updatedAdmin);

    return res.status(200).json({
      message: "Admin updated successfully",
      data: updatedAdmin,
    });

  } catch (e) {
    console.error("Admin update failed:", e);
    res.status(400).json({ error: "Update failed" });
  }
};

module.exports = {
  registerAdmin,
  loginAdmin,
  getAllUsers,
  callNextUser,
  getAnalytics,
  updateQueueStatus,
  deleteAdmin,
  updateAdmin,
  setIoInstance,
};