// seedChallenges.js
const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../../", ".env"),
});
const mongoose = require("mongoose");
const Challenge = require("./challenge.model"); // adjust path if needed

// 🧱 Challenge tiers (realistic PeakProfit-style)
const challenges = [
  {
    name: "Starter Challenge",
    cost: 49,
    accountSize: 10000,
  },
  {
    name: "Intermediate Challenge",
    cost: 99,
    accountSize: 25000,
  },
  {
    name: "Pro Challenge",
    cost: 199,
    accountSize: 50000,
  },
  {
    name: "Elite Challenge",
    cost: 399,
    accountSize: 100000,
  },
  {
    name: "Master Challenge",
    cost: 599,
    accountSize: 200000,
  },
  {
    name: "Ultimate Challenge",
    cost: 999,
    accountSize: 400000,
  },
];

async function seedChallenges() {
  try {
    await mongoose.connect(process.env.DB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected to MongoDB");

    // Remove existing challenges to avoid duplicates
    await Challenge.deleteMany({});
    console.log("🗑️  Existing challenges removed");

    // Insert new ones
    await Challenge.insertMany(challenges);
    console.log("✨ Challenges seeded successfully");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seedChallenges();
