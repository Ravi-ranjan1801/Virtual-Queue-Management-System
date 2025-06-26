const { User, Admin } = require("../models/User");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");


let io;

const setIoInstance = (ioInstance) => {
  io = ioInstance;
};

const registerUser = async (req, res) => {
  const { fullName } = req.body;
  const { admin } = req.body;
  const existingUser = await User.findOne({ fullName });
  if (existingUser) {
    console.log("User already exists");
    return res.status(400).json({ error: "User already exists" });
  }
  try {
    if (!mongoose.Types.ObjectId.isValid(admin)) {
      return res.status(400).json({ error: "Invalid admin ID" });
    }

    const userDoc = await User.create({
      fullName: req.body.fullName,
      email: req.body.email,
      phone: req.body.phone,
      role: req.body.role,
      admin: admin,
    });

    await Admin.findByIdAndUpdate(admin, { $push: { users: userDoc._id } });
    // console.log('Registered Successfully:', userDoc);
    io.emit("user-updated", userDoc);
    return res.status(200).json({
      data: userDoc,
    });
  } catch (e) {
    console.log("Failed Submission");
    console.error(e);
    res.status(400).json(e);
  }
};

const loginUser = async (req, res) => {
  const { email } = req.body;

  try {
    const userDoc = await User.findOne({ email });
    if (!userDoc) {
      return res.status(400).json({ error: "User not found" });
    }
    const token = jwt.sign(
      { email: email, id: userDoc._id, role: userDoc.role },
      process.env.SECRET_KEY,
      { expiresIn: "24h" }
    );
    res.cookie("usertoken", token, { httpOnly: true }).json({
      message: "Login Successful",
      data: userDoc,
      token: token, 
    });
  } catch (e) {
    console.log("Error during login", e);
    return res.status(500).json({ error: "INTERNAL SERVER ERROR" });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ error: "User not found" });
    }
    console.log("Deleted Successfully:", deletedUser);
    io.emit("user-deleted", deletedUser);
    return res.status(200).json({
      message: "User deleted successfully",
      data: deletedUser,
    });
  } catch (e) {
    console.log("Failed to delete user");
    console.error(e);
    res.status(400).json(e);
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const { fullName, email, phone, timeRemaining } = req.body;
  try {
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { fullName, email, phone, timeRemaining },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }
    console.log("Updated Successfully:", updatedUser);
    io.emit("user-updated", updatedUser);
    return res.status(200).json({
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (e) {
    console.log("Failed to update user");
    console.error(e);
    res.status(400).json(e);
  }
};

const getUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(200).json({
      message: "User details fetched successfully",
      data: user,
    });
  } catch (e) {
    console.log("Failed to fetch user details");
    res.status(400).json(e);
  }
};

module.exports = {
  registerUser,
  setIoInstance,
  loginUser,
  deleteUser,
  updateUser,
  getUser,
};
