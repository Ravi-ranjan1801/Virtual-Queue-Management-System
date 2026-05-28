const { User, Admin } = require("../models/User");
const { recalculateQueue } = require("./User");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const salt = bcryptjs.genSaltSync(10);

let io;
const setIoInstance = (ioInstance) => { io = ioInstance; };

// ── Register admin ─────────────────────────────────────────────────────────
const registerAdmin = async (req, res) => {
  try {
    const { fullName, email, phone, password, adminSecret } = req.body;

    if (adminSecret !== process.env.ADMIN_SECRET_CODE) {
      return res.status(403).json({ error: "Invalid admin secret code" });
    }

    const existing = await Admin.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const adminDoc = await Admin.create({
      fullName, email, phone,
      password: bcryptjs.hashSync(password, salt),
      delay: 10,
      queueStatus: "notStarted",
    });

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

// ── Login admin ────────────────────────────────────────────────────────────
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
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
      message: "Login Successful", data: adminDoc, token,
    });

  } catch (e) {
    console.error("Admin login error:", e);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ── Get all users for admin dashboard ─────────────────────────────────────
// Fix: just read from DB — never overwrite timeRemaining on fetch
const getAllUsers = async (req, res) => {
  try {
    const { adminId } = req.params;
    const admin = await Admin.findById(adminId);
    if (!admin) return res.status(404).json({ error: "Admin not found" });

    const users = await User.find({ admin: adminId }).sort({ createdAt: 1 });

    return res.status(200).json({ data: admin, user: users });

  } catch (e) {
    console.error("getAllUsers error:", e);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ── Pop current user (admin marks current user as done, removes them) ──────
// This is the core admin action — like calling "next" at a hospital counter
// LLD: Single responsibility — one function, one job
const popCurrentUser = async (req, res) => {
  const { adminId } = req.params;
  try {
    // First user by join time = currently being served
    const firstUser = await User.findOne({ admin: adminId }).sort({ createdAt: 1 });

    if (!firstUser) {
      return res.status(404).json({ error: "Queue is empty" });
    }

    // Remove them — they've been served
    await User.findByIdAndDelete(firstUser._id);
    await Admin.findByIdAndUpdate(adminId, {
      $inc: { totalServed: 1 },
      $pull: { users: firstUser._id },
    });

    // Recalculate positions and wait times for remaining users
    const updatedUsers = await recalculateQueue(adminId);

    // Notify position 2 user (index 1) — their turn is approaching
    // "gets notified when position becomes 2nd"
    if (updatedUsers.length >= 2) {
      const nextUpUser = updatedUsers[1]; // new position 2
      if (!nextUpUser.smsSent) {
        // Socket notification to their dashboard
        io.to(`queue_${adminId}`).emit("user-nearly-called", {
          userId: nextUpUser._id.toString(),
          ticketNumber: nextUpUser.ticketNumber,
          name: nextUpUser.fullName,
        });
        // Mark SMS sent to avoid repeat
        await User.findByIdAndUpdate(nextUpUser._id, { smsSent: true });
      }
    }

    io.to(`queue_${adminId}`).emit("queue-updated", updatedUsers);

    return res.status(200).json({
      message: `${firstUser.fullName} (${firstUser.ticketNumber}) served and removed`,
      data: updatedUsers,
    });

  } catch (e) {
    console.error("Pop user failed:", e);
    res.status(500).json({ error: "Failed to pop current user" });
  }
};

// ── Analytics ──────────────────────────────────────────────────────────────
const getAnalytics = async (req, res) => {
  const { adminId } = req.params;
  try {
    const admin = await Admin.findById(adminId);
    if (!admin) return res.status(404).json({ error: "Admin not found" });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayUsers = await User.find({
      admin: adminId,
      createdAt: { $gte: todayStart },
    });

    const currentlyWaiting = await User.countDocuments({ admin: adminId });

    return res.status(200).json({
      data: {
        totalServed: admin.totalServed,
        totalToday: todayUsers.length,
        currentlyWaiting,
        avgServingTimeMinutes: admin.delay,
        avgWaitTimeMinutes: Math.round(admin.delay * currentlyWaiting / 2),
      },
    });

  } catch (e) {
    console.error("Analytics error:", e);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
};

// ── Delete admin ───────────────────────────────────────────────────────────
const deleteAdmin = async (req, res) => {
  try {
    const deletedAdmin = await Admin.findByIdAndDelete(req.params.id);
    if (!deletedAdmin) return res.status(404).json({ error: "Admin not found" });

    await User.deleteMany({ admin: req.params.id });
    io.emit("admin-deleted", deletedAdmin);

    return res.status(200).json({ message: "Admin deleted", data: deletedAdmin });

  } catch (e) {
    console.error("Delete admin failed:", e);
    res.status(500).json({ error: "Delete failed" });
  }
};

// ── Update admin profile ───────────────────────────────────────────────────
const updateAdmin = async (req, res) => {
  const { adminId } = req.params;
  const { fullName, email, phone } = req.body;
  try {
    const updated = await Admin.findByIdAndUpdate(
      adminId,
      { fullName, email, phone },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: "Admin not found" });
    io.emit("admin-updated", updated);
    return res.status(200).json({ data: updated });
  } catch (e) {
    console.error("Update admin failed:", e);
    res.status(400).json({ error: "Update failed" });
  }
};

module.exports = {
  registerAdmin, loginAdmin, getAllUsers,
  popCurrentUser, getAnalytics,
  deleteAdmin, updateAdmin, setIoInstance,
};