const express = require("express");
const router = express.Router();
const {
  registerUser, loginUser, deleteUser, leaveQueue, getUser,
} = require("../controllers/User");

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/:id", getUser);
router.delete("/:id", deleteUser);
router.delete("/:id/leave", leaveQueue);

module.exports = router;