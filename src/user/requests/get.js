const User = require("../user.model"); // Adjust the path based on your project structure

const getUser = async (req, res) => {
  try {
    const { email } = req.user; // Extract email from req.user
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    // Query the database for the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Select only the required fields
    console.log(user);
    const userData = {
      id: user._id,
      email: user.email,
      name: user.name,
      profilePicture: user.profilePicture,
    };

    res.json(userData);
  } catch (error) {
    console.error("Error fetching user:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching user data." });
  }
};

module.exports = getUser;
