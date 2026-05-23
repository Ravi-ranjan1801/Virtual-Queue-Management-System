const express = require("express");
const router = express.Router();
const {
  registerAdmin,
  loginAdmin,
  getAllUsers,
  callNextUser,
  getAnalytics,
  updateQueueStatus,
  deleteAdmin,
  updateAdmin,
} = require("../controllers/Admin");

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.get("/:adminId", getAllUsers);
router.post("/:adminId/call-next", callNextUser);
router.get("/:adminId/analytics", getAnalytics);
router.put("/:adminId/queue-status", updateQueueStatus);
router.delete("/:id", deleteAdmin);
router.put("/:adminId", updateAdmin);

module.exports = router;