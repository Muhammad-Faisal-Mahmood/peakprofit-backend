// seedChallenges.js
const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../../", ".env"),
});
const mongoose = require("mongoose");
const Challenge = require("./challenge.model"); // adjust path if needed

const challenges = [
  { name: "Starter Challenge", cost: 49 },
  { name: "Intermediate Challenge", cost: 99 },
  { name: "Pro Challenge", cost: 199 },
  { name: "Elite Challenge", cost: 399 },
  { name: "Master Challenge", cost: 599 },
  { name: "Ultimate Challenge", cost: 999 },
];

async function seedChallenges() {
  try {
    await mongoose.connect(process.env.DB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to MongoDB");

    console.log("Existing challenges removed");

    // Insert new challenges
    await Challenge.insertMany(challenges);
    console.log("Challenges seeded successfully");

    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
}

seedChallenges();
