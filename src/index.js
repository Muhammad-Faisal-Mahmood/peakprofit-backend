const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env"),
});

const auth = require("./auth/auth.controller");
const user = require("./user/user.controller");
const admin = require("./admin/admin.controller");
const subscription = require("./subscription/subscription.controller");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ✅ Serve static content from the public folder outside src
app.use(express.static(path.resolve(__dirname, "..", "public")));

app.use(
  cors({
    origin: "*",
  })
);

// Passport setup
app.use(
  session({
    secret: process.env.PASSPORT_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/api/auth", auth);
app.use("/api/user", user);
app.use("/api/admin", admin);
app.use("/api/subscription", subscription);

// MongoDB Connection
const connectToMongoDB = async () => {
  try {
    await mongoose.connect(process.env.DB_URL);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
    process.exit(1);
  }
};

connectToMongoDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
});
