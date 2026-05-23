const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  deleteUser,
  leaveQueue,
  updateUser,
  updateUserStatus,
  getUser,
  confirmPresence,
} = require("../controllers/User");

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/:id", getUser);
router.delete("/:id", deleteUser);
router.delete("/:id/leave", leaveQueue);       // voluntary leave
router.put("/:id", updateUser);
router.put("/:id/status", updateUserStatus);   // status transitions
router.post("/:id/confirm-presence", confirmPresence);

module.exports = router;