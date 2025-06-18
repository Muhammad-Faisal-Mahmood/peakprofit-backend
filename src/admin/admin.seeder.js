const mongoose = require("mongoose");
const { bcryptPassword } = require("../shared/GeneralHelper");
const User = require("../user/user.model");

const path = require("path"); // Add this line

require("dotenv").config({
  path: path.resolve(__dirname, "../..", ".env"), // Go up one directory from src
});

async function createAdmin() {
  try {
    await mongoose.connect(process.env.DB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const existingAdmin = await User.findOne({
      email: "dawsonmarks@admin.com",
    });

    if (existingAdmin) {
      console.log("Admin user already exists.");
      return;
    }

    const hashedPassword = await bcryptPassword("!Dawson@8311"); // You can change this password

    const admin = new User({
      _id: new mongoose.Types.ObjectId(),
      email: "dawsonmarks@admin.com",
      name: "Dawson Marks",
      password: hashedPassword,
      isVerified: true,
      role: "Admin",
      profilePicture: "",
    });

    await admin.save();

    console.log("✅ Admin user created successfully.");
  } catch (err) {
    console.error("❌ Error creating admin:", err);
  } finally {
    await mongoose.disconnect();
  }
}

createAdmin();
