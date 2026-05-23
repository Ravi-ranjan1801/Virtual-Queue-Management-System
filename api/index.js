const express = require("express");
const cors = require("cors");
const http = require("http");
const mongoose = require("mongoose");
const cron = require("node-cron");
const rateLimit = require("express-rate-limit");

const initializeIo = require("./controllers/initializeIo");
const { User, Admin, USER_STATUS } = require("./models/User");
const dbConnect = require("./config/database");
const { recalculateQueue } = require("./controllers/User");
const { setIoInstance: setUserIoInstance } = require("./controllers/User");
const { setIoInstance: setAdminIoInstance } = require("./controllers/Admin");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");

// Always load .env from this file's directory — works regardless of where
// node is run from
require("dotenv").config({ path: __dirname + "/.env" });

const app = express();
const server = http.createServer(app);

// ─── Middleware ────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      process.env.CLIENT_URL,
    ].filter(Boolean),
    credentials: true,
  })
);

// ─── Rate Limiting ─────────────────────────────────────────────────────────
// LLD: Open/Closed principle — rate limiter is a separate middleware,
// easy to configure without touching route logic

const registerLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,                    // max 5 registrations per IP per window
  message: {
    error: "Too many registration attempts. Please try again after 10 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply only to register routes
app.use("/user/register", registerLimiter);
app.use("/admin/register", registerLimiter);

// ─── Socket.io Setup ───────────────────────────────────────────────────────
const io = initializeIo(server);
setUserIoInstance(io);
setAdminIoInstance(io);

// Socket.io rooms — each admin queue is its own room
// LLD: Isolation — updates only go to users in the correct queue
// Scalability — no global broadcasts, targeted emits only
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Client joins their queue room on connection
  // Frontend must emit this event right after connecting
  socket.on("join-queue", (adminId) => {
    socket.join(`queue_${adminId}`);
    console.log(`Socket ${socket.id} joined queue_${adminId}`);
  });

  // Admin joins their own queue room to receive updates
  socket.on("join-admin", (adminId) => {
    socket.join(`queue_${adminId}`);
    console.log(`Admin ${socket.id} joined queue_${adminId}`);
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// ─── Database ──────────────────────────────────────────────────────────────
dbConnect();

// ─── Routes ────────────────────────────────────────────────────────────────
app.use("/user", userRoutes);
app.use("/admin", adminRoutes);

// Get all admins — used in Register page dropdown
app.get("/admins", async (req, res) => {
  try {
    // Only return fields needed for dropdown — not password etc.
    const admins = await Admin.find({}, "fullName email queueStatus");
    return res.status(200).json({ data: admins });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch admins" });
  }
});

// ─── Set Time Per User ─────────────────────────────────────────────────────
app.put("/users/set-time/:admin_id", async (req, res) => {
  const { admin_id } = req.params;
  try {
    const admin = await Admin.findById(admin_id);
    if (!admin) return res.status(404).json({ error: "Admin not found" });

    const newDelay = Number(req.body.time);
    if (isNaN(newDelay) || newDelay < 1) {
      return res.status(400).json({ error: "Time must be a positive number" });
    }

    // Update admin's delay setting
    admin.delay = newDelay;
    await admin.save();

    // Recalculate all user wait times with new delay
    const updatedUsers = await recalculateQueue(admin_id);

    io.to(`queue_${admin_id}`).emit("queue-updated", updatedUsers);

    res.status(200).json({ data: updatedUsers });
  } catch (error) {
    console.error("Error setting time:", error);
    res.status(500).json({ error: "Error setting time for users" });
  }
});

// ─── Start / Stop Queue (toggle) ───────────────────────────────────────────
// Also resumes cron job if previously running
let cronJobs = {};

app.post("/start-process/:admin_id", async (req, res) => {
  const { admin_id } = req.params;
  try {
    const admin = await Admin.findById(admin_id);
    if (!admin) return res.status(404).json({ error: "Admin not found" });

    admin.start = !admin.start;
    admin.queueStatus = admin.start ? "active" : "paused";
    await admin.save();

    if (admin.start) {
      // Start or resume cron job for this queue
      if (!cronJobs[admin_id]) {
        cronJobs[admin_id] = initCronJob(admin_id.toString());
      }
      cronJobs[admin_id].start();

      // Send SMS to second user in queue (next up)
      const users = await User.find({
        admin: admin_id,
        status: USER_STATUS.WAITING,
      }).sort({ createdAt: 1 });

      if (users.length > 1 && !users[1].smsSent) {
        const waitMins = Math.ceil(users[1].timeRemaining / 60);
        await sendSms(
          users[1].phone,
          `Hello ${users[1].fullName}, your ticket is ${users[1].ticketNumber}. ` +
          `Your turn is coming up in ~${waitMins} minutes. Please be ready.`
        );
        await User.findByIdAndUpdate(users[1]._id, { smsSent: true });
      }
    } else {
      // Stop cron job
      if (cronJobs[admin_id]) {
        cronJobs[admin_id].stop();
      }
    }

    // Notify all users in this queue about status change
    io.to(`queue_${admin_id}`).emit("queue-status-changed", {
      queueStatus: admin.queueStatus,
      pauseReason: admin.pauseReason || "",
    });

    return res.status(200).json({ message: "Queue toggled", admin });
  } catch (error) {
    console.error("Error toggling queue:", error);
    res.status(500).json({ error: "Error toggling queue" });
  }
});

// ─── Cron Job — runs every second to countdown timers ─────────────────────
// LLD: Single Responsibility — cron only decrements timers
// Business logic (recalculate, status) handled in controllers
const initCronJob = (admin_id) => {
  // Stop existing job if any before creating new one
  if (cronJobs[admin_id]) {
    cronJobs[admin_id].stop();
  }

  const cronJob = cron.schedule(
    "* * * * * *", // every second
    async () => {
      try {
        if (!mongoose.Types.ObjectId.isValid(admin_id)) return;

        const users = await User.find({
          admin: admin_id,
          status: { $in: [USER_STATUS.WAITING, USER_STATUS.CALLED] },
        }).sort({ createdAt: 1 });

        for (const user of users) {
          if (user.timeRemaining > 0) {
            user.timeRemaining -= 1;
            await user.save();
          } else if (
            user.timeRemaining === 0 &&
            user.status === USER_STATUS.WAITING
          ) {
            // Time expired — mark as expired, don't delete immediately
            // Admin can review expired users
            user.status = USER_STATUS.EXPIRED;
            await user.save();
            console.log(`User ${user.fullName} (${user.ticketNumber}) expired`);

            io.to(`queue_${admin_id}`).emit("user-expired", {
              userId: user._id,
              ticketNumber: user.ticketNumber,
              name: user.fullName,
            });
          }
        }

        // Emit updated queue to all clients in this room
        const allUsers = await User.find({
          admin: admin_id,
        }).sort({ createdAt: 1 });

        io.to(`queue_${admin_id}`).emit("time-updated", allUsers);

      } catch (error) {
        console.error(`Cron error for admin ${admin_id}:`, error);
      }
    },
    { scheduled: false }
  );

  return cronJob;
};

// ─── Resume cron jobs on server restart ───────────────────────────────────
// If server crashes and restarts, pick up where we left off
const resumeCronJobs = async () => {
  try {
    const activeAdmins = await Admin.find({ start: true });
    for (const admin of activeAdmins) {
      const id = admin._id.toString();
      cronJobs[id] = initCronJob(id);
      cronJobs[id].start();
      console.log(`Resumed cron job for admin: ${admin.fullName}`);
    }
  } catch (e) {
    console.error("Failed to resume cron jobs:", e);
  }
};

// ─── SMS Helper ────────────────────────────────────────────────────────────
const sendSms = async (phone, message) => {
  try {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.TWILIO_ACCOUNT_SID
    ) {
      const twilio = require("twilio");
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: `+91${phone}`, // prepend India code
      });
      console.log(`SMS sent to ${phone}`);
    } else {
      console.log(`[SMS MOCK] To: ${phone} | Message: ${message}`);
    }
  } catch (e) {
    console.error("SMS failed:", e.message);
    // Don't throw — SMS failure should never crash the server
  }
};

// ─── Start Server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  console.log(`Server started at PORT: ${PORT}`);
  // Resume any active queues after restart
  await resumeCronJobs();
});