const { User, Admin } = require("../models/User");
const bcryptjs = require("bcryptjs");
const salt = bcryptjs.genSaltSync(10);
const jwt = require("jsonwebtoken");

let io;

const setIoInstance = (ioInstance) => {
  io = ioInstance;
};

const registerAdmin = async (req, res) => {
  const { fullName } = req.body;
  const existingUser = await User.findOne({ fullName });
  if (existingUser) {
    console.log("Admin already exists");
    return res.status(400).json({ error: "Admin already exists" });
  }
  try {
    const adminDoc = await Admin.create({
      fullName: req.body.fullName,
      email: req.body.email,
      phone: req.body.phone,
      role: req.body.role,
      password: bcryptjs.hashSync(req.body.password, salt),
      start: false,
    });
    // console.log('Registered Successfully:', adminDoc);
    io.emit("admin-updated", adminDoc);
    return res.status(200).json({
      data: adminDoc,
    });
  } catch (e) {
    console.log("Failed Submission");
    console.error(e);
    res.status(400).json(e);
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

      // console.log("Admin is logged in");
    } else {
      console.log("Wrong Password");
      res.status(404).json({ error: "Wrong Credentials" });
    }
  } catch (e) {
    console.log("Error during login", e);
    res.status(500).json({ error: "INTERNAL SERVER ERROR" });
  }
};

const getAllUsers = async (req, res) => {
  const { adminId } = req.params;
  const admin = await Admin.findById(adminId);
  // const allUsers = await User.find({ admin: adminId });
  const allUsers = await User.find({ admin: adminId }).sort({ createdAt: 1 });
  
      const time = allUsers[1].timeRemaining - allUsers[0].timeRemaining;
      let cumulativeTime = 0;
      for (let i = 0; i < allUsers.length; i++) {
        allUsers[i].timeRemaining = cumulativeTime + time;
        cumulativeTime = allUsers[i].timeRemaining;
        await allUsers[i].save();
      }

  return res.status(200).json({
    message: "Welcome to Home Page",
    data: admin,
    user: allUsers,
  });
};

const deleteAdmin = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedAdmin = await Admin.findByIdAndDelete(id);
    if (!deletedAdmin) {
      return res.status(404).json({ error: "Admin not found" });
    }
    console.log("Deleted Successfully:", deletedAdmin);
    io.emit("admin-deleted", deletedAdmin);
    return res.status(200).json({
      message: "User deleted successfully",
      data: deletedAdmin,
    });
  } catch (e) {
    console.log("Failed to delete user");
    console.error(e);
    res.status(400).json(e);
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
    // console.log('Updated Successfully:', updatedAdmin);
    io.emit("admin-updated", updatedAdmin);
    return res.status(200).json({
      message: "Admin updated successfully",
      data: updatedAdmin,
    });
  } catch (e) {
    console.log("Failed to update admin");
    console.error(e);
    res.status(400).json(e);
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
