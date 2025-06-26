const express = require("express");
const router = express.Router();
const {
  registerAdmin,
  loginAdmin,
  getAllUsers,
  deleteAdmin,
  updateAdmin,
} = require("../controllers/Admin");

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);

router.get("/:adminId", getAllUsers);
router.delete("/:id", deleteAdmin);
router.put("/:adminId", updateAdmin);

module.exports = router;
