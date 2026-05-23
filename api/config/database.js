const mongoose = require("mongoose");

// dotenv already loaded in index.js before this is called
const dbConnect = () => {
  mongoose
    .connect(process.env.DB_URL)
    .then(() => {
      console.log("Connected to Database");
    })
    .catch((e) => {
      console.error("Database connection failed:", e.message);
      process.exit(1); // exit if no DB — server is useless without it
    });
};

module.exports = dbConnect;