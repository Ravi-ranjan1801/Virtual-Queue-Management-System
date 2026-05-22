const { User, Admin } = require("../models/User");
const bcryptjs = require("bcryptjs");
const salt = bcryptjs.genSaltSync(10);
const jwt = require("jsonwebtoken");

const TIME_PER_USER = 5; // minutes per person in queue

let io;

const setIoInstance = (ioInstance) => {
  io = ioInstance;
};

const registerAdmin = async (req, res) => {
  try {
    // Bug fix: check by email, not fullName
    const existingUser = await Admin.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json({ error: "Admin already exists" });
    }

    const adminDoc = await Admin.create({
      fullName: req.body.fullName,
      email: req.body.email,
      phone: req.body.phone,
      role: req.body.role,
      password: bcryptjs.hashSync(req.body.password, salt),
      start: false,
    });

    io.emit("admin-updated", adminDoc);
    return res.status(200).json({ data: adminDoc });

  } catch (e) {
    console.error("Registration failed:", e);
    res.status(400).json({ error: "Registration failed" });
  }
};

const loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const adminDoc = await Admin.findOne({ email });
    if (!adminDoc) {
      return res.status(400).json({ error: "Admin not found" });
    }

    const passOk = await bcryptjs.compare(password, adminDoc.password);
    if (passOk) {
      const token = jwt.sign(
        { email: email, id: adminDoc._id, role: adminDoc.role },
        process.env.SECRET_KEY,
        { expiresIn: "24h" }
      );
      res.cookie("admintoken", token, { httpOnly: true }).json({
        message: "Login Successful",
        data: adminDoc,
        token: token,
      });
    } else {
      res.status(404).json({ error: "Wrong Credentials" });
    }

  } catch (e) {
    console.error("Error during login:", e);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const { adminId } = req.params;
    const admin = await Admin.findById(adminId);

    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    const allUsers = await User.find({ admin: adminId }).sort({ createdAt: 1 });

    // Bug fix: use fixed time constant + bulk update instead of N individual saves
    const bulkOps = allUsers.map((user, i) => ({
      updateOne: {
        filter: { _id: user._id },
        update: { $set: { timeRemaining: i * TIME_PER_USER } },
      },
    }));

    if (bulkOps.length > 0) {
      await User.bulkWrite(bulkOps);
    }

    // Reflect updated values in the response
    const updatedUsers = allUsers.map((user, i) => ({
      ...user.toObject(),
      timeRemaining: i * TIME_PER_USER,
    }));

    return res.status(200).json({
      message: "Welcome to Home Page",
      data: admin,
      user: updatedUsers,
    });

  } catch (e) {
    console.error("Error in getAllUsers:", e);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const deleteAdmin = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedAdmin = await Admin.findByIdAndDelete(id);
    if (!deletedAdmin) {
      return res.status(404).json({ error: "Admin not found" });
    }
    io.emit("admin-deleted", deletedAdmin);
    return res.status(200).json({
      message: "Admin deleted successfully",
      data: deletedAdmin,
    });
  } catch (e) {
    console.error("Failed to delete admin:", e);
    res.status(400).json({ error: "Delete failed" });
  }
};

const updateAdmin = async (req, res) => {
  const { adminId } = req.params;
  const { fullName, email, phone } = req.body;
  try {
    const updatedAdmin = await Admin.findByIdAndUpdate(
      adminId,
      { fullName, email, phone },
      { new: true }
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
    console.error("Failed to update admin:", e);
    res.status(400).json({ error: "Update failed" });
  }
};

module.exports = {
  registerAdmin,
  loginAdmin,
  getAllUsers,
  deleteAdmin,
  updateAdmin,
  setIoInstance,
};