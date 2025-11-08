const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const path = require("path");
const expressWs = require("express-ws");

require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env"),
});

const auth = require("./auth/auth.controller");
const user = require("./user/user.controller");
const admin = require("./admin/admin.controller");
const subscription = require("./subscription/subscription.controller");
const contact = require("./contact/contact.controller");
const affiliate = require("./affiliate/affiliate.controller");
const challenge = require("./challenge/challenge.controller");
const withdraw = require("./withdraw/withdraw.controller");
const kyc = require("./kyc/kyc.controller");
const ticket = require("./ticket/ticket.controller");
const tradeJournal = require("./trade/journal/journal.controller");
const polygon = require("./polygon/polygon.controller");
const watchlist = require("./trade/watchlist/watchlist.controller");
const Account = require("./trade/account/account.controller");

const app = express();
expressWs(app); // Enable WebSocket support

const PORT = process.env.PORT || 3000;
const allowedOrigins = [
  process.env.MARKETING_SITE_URL,
  process.env.FRONT_APP_URL_DEV,
];

app.use(express.json());

// ✅ Serve static content from the public folder outside src
app.use(express.static(path.resolve(__dirname, "..", "public")));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
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
app.use("/api/contact", contact);
app.use("/api/affiliate", affiliate);
app.use("/api/challenge", challenge);
app.use("/api/withdraw", withdraw);
app.use("/api/kyc", kyc);
app.use("/api/ticket", ticket);
app.use("/api/trade/journal", tradeJournal);
app.use("/api/polygon", polygon);
app.use("/api/trade/watchlist", watchlist);
app.use("/api/trade/account", Account);

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
