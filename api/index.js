const express = require("express");
const cors = require("cors");
const http = require("http");
const initializeIo = require("./controllers/initializeIo");
const { User, Admin } = require("./models/User");
const dbConnect = require("./config/database");
const cron = require("node-cron");
const twilio = require("twilio");
const mongoose = require("mongoose");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { setIoInstance: setUserIoInstance } = require("./controllers/User");
const { setIoInstance: setAdminIoInstance } = require("./controllers/Admin");

require("dotenv").config();
const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

const io = initializeIo(server);
setUserIoInstance(io);
setAdminIoInstance(io);

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

dbConnect();

app.use("/user", userRoutes);
app.use("/admin", adminRoutes);

app.get("/admins", async (req, res) => {
  const admin = await Admin.find({});
  return res.status(200).json({
    data: admin,
  });
});

app.put("/users/set-time/:admin_id", async (req, res) => {
  const { admin_id } = req.params;
  try {

    const admin = await Admin.findById(admin_id);
    admin.delay = req.body.time;
    await admin.save();
    const time = Number(req.body.time) * 60;
    const users = await User.find({ admin: admin_id }).sort({ createdAt: 1 });

    let cumulativeTime = 0;
    for (let i = 0; i < users.length; i++) {
      users[i].timeRemaining = cumulativeTime + time;
      cumulativeTime = users[i].timeRemaining;
      await users[i].save();
    }

    io.emit("time-updated", users);

    res.status(200).json({ data: users });
  } catch (error) {
    console.log("Error setting time for users:", error);
    res.status(500).json({ error: "Error setting time for users" });
  }
});

let cronJobs = {};

app.post("/start-process/:admin_id", async (req, res) => {
  const { admin_id } = req.params;
  // console.log('Received admin_id:', admin_id);
  try {
    const admin = await Admin.findById(admin_id);
    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    admin.start = !admin.start;
    await admin.save();

    if (admin.start) {
      if (!cronJobs[admin_id]) {
        cronJobs[admin_id] = initCronJob(admin_id.toString());
      }
      cronJobs[admin_id].start();

      const users = await User.find({ admin: admin_id }).sort({ createdAt: 1 });
      if (users.length > 1 && users[1].timeRemaining > 0 && !users[1].smsSent) {
        await sendSms(users[1]);
      }
    } else {
      if (cronJobs[admin_id]) {
        cronJobs[admin_id].stop();
      }
    }

    return res.status(200).json({ message: "Process state toggled", admin });
  } catch (error) {
    console.error("Error toggling process state:", error);
    res.status(500).json({ error: "Error toggling process state" });
  }
});

const initCronJob = (admin_id) => {
  if (cronJobs[admin_id]) {
    cronJobs[admin_id].stop();
  }

  const cronJob = cron.schedule(
    "* * * * * *",
    async () => {
      try {
        // console.log('admin_id in cron job:', admin_id);

        if (!mongoose.Types.ObjectId.isValid(admin_id)) {
          console.log("Invalid admin ID");
          return;
        }
        const users = await User.find({ admin: admin_id }).sort({
          createdAt: 1,
        });
        for (const user of users) {
          if (user.timeRemaining > 0) {
            user.timeRemaining -= 1;
            await user.save();
          }
          if (user.timeRemaining === 0) {
            await User.findByIdAndDelete(user._id);
            console.log(
              `User ${user.fullName} deleted due to time expiration.`
            );
          }
        }
        io.emit("time-updated", users);
      } catch (error) {
        console.error("Error updating timeRemaining for users:", error);
      }
    },
    {
      scheduled: false,
    }
  );

  return cronJob;
};

const formatTime = (timeInSeconds) => {
  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor((timeInSeconds % 3600) / 60);
  const seconds = timeInSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
};

const sendSms = async (user) => {
  const time = formatTime(user.timeRemaining);
  try {
    const message = await client.messages.create({
      body: `Hello ${user.fullName}, you are now at position 2 in the queue. Your turn is coming in ${time}.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+91${user.phone}`,
    });
    console.log(`SMS sent to ${user.phone}: ${message.sid}`);
    user.smsSent = true;
    await user.save();
  } catch (error) {
    console.log("Error sending SMS:", error);
  }
};

server.listen(process.env.PORT, () => {
  console.log(`Server started at PORT:${process.env.PORT}`);
});
