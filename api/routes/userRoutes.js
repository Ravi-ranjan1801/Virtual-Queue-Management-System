const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  deleteUser,
  updateUser,
  getUser,
} = require("../controllers/User");

router.post("/register", registerUser);
router.delete("/:id", deleteUser);
router.put("/:id", updateUser);
router.get("/:id", getUser);
router.post("/login", loginUser);

module.exports = router;
