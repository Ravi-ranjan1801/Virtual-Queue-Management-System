const mongoose = require("mongoose");
require("dotenv").config();

const dbConnect = () => {
  mongoose
    .connect(process.env.DB_URL)
    .then(() => {
      console.log("Connected to Database");
    })
    .catch((e) => {
      console.log("Error in connection to database");
      console.error(e);
    });
};

module.exports = dbConnect;
