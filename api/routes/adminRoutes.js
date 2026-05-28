const express = require("express");
const router = express.Router();
const {
  registerAdmin, loginAdmin, getAllUsers,
  popCurrentUser, getAnalytics,
  deleteAdmin, updateAdmin,
} = require("../controllers/Admin");

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.get("/:adminId", getAllUsers);
router.post("/:adminId/pop", popCurrentUser);      // admin done → next
router.get("/:adminId/analytics", getAnalytics);
router.delete("/:id", deleteAdmin);
router.put("/:adminId", updateAdmin);

module.exports = router;