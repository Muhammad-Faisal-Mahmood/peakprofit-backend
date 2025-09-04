const User = require("../user.model"); // Adjust the path based on your project structure
const { getAffiliateStatusByUserId } = require("../../shared/GeneralHelper");

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

    const affiliateStatus = await getAffiliateStatusByUserId(user._id);
    const userData = {
      id: user._id,
      email: user.email,
      name: user.name,
      profilePicture: user.profilePicture,
      role: user.role,
      affiliateId: user?.affiliateId,
      referredBy: user?.referredBy,
      affiliateStatus: affiliateStatus,
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
