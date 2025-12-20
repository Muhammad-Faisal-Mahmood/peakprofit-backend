const mongoose = require("mongoose");
const User = require("./user/user.model"); // adjust path if needed

const MONGO_URI = "mongodb://localhost:27017/peakProfit";

async function addStatusField() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to MongoDB");

    const result = await User.updateMany(
      { status: { $exists: false } }, // only users without status
      { $set: { status: "Active" } }
    );

    console.log(`Updated ${result.modifiedCount} users`);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

addStatusField();
