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
    name: "5k Challenge",
    cost: 25,
    accountSize: 5000,
  },
  {
    name: "10k Challenge",
    cost: 60,
    accountSize: 10000,
  },
  {
    name: "25k Challenge",
    cost: 100,
    accountSize: 25000,
  },
  {
    name: "50k Challenge",
    cost: 150,
    accountSize: 50000,
  },
  {
    name: "100k Challenge",
    cost: 350,
    accountSize: 100000,
  },
  {
    name: "200k Challenge",
    cost: 600,
    accountSize: 200000,
  },
  {
    name: "300k Challenge",
    cost: 750,
    accountSize: 300000,
  },
  {
    name: "500k Challenge",
    cost: 1200,
    accountSize: 500000,
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
