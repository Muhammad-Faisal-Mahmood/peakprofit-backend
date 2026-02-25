const User = require("../user/user.model");
const { sendEmail } = require("../shared/mail.service");
const path = require("path");
const logoPath = require("../constants/logoPath");
async function sendAccountActivationEmail(account, userId) {
  try {
    // Fetch user data
    const user = await User.findById(userId).select("name email");

    if (!user || !user.email) {
      throw new Error("User email not found");
    }

    // Extract first name from full name or use email username
    const firstName = user.name
      ? user.name.split(" ")[0]
      : user.email.split("@")[0];

    // Format start date
    const startDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Determine account currency (assuming USD as default)
    const accountCurrency = "USD";

    // Format account size with currency symbol
    const formattedAccountSize = `$${account.initialBalance.toLocaleString()}`;

    // Determine account type display name
    const accountTypeDisplay =
      account.accountType === "demo" ? "Demo Account" : "Live Account";

    // Server name (default to PeakMarkets-Live or based on your config)
    const serverName = "PeakMarkets";

    // Calculate percentages for rules
    const dailyDD = 2.5;
    const maxDD = 7;
    const profitTarget = 8;

    const replacements = {
      first_name: firstName,
      email: user.email,
      account_size: formattedAccountSize,
      account_currency: accountCurrency,
      account_type: accountTypeDisplay,
      server_name: serverName,
      start_date: startDate,
      daily_dd: dailyDD,
      max_dd: maxDD,
      profit_target: profitTarget,
      min_trading_days: account.minTradingDays,
      year: new Date().getFullYear(),
      unsubscribe_url: "#", // Placeholder until unsubscribe functionality is implemented
      logoUrl: logoPath,
    };

    const template = path.join(__dirname, "mails", "FundedAccount.html");

    await sendEmail(
      "Your Evaluation Account Is Active ✅",
      template,
      user.email,
      replacements,
    );

    console.log(`Account activation email sent to ${user.email}`);
  } catch (error) {
    console.error("Error sending account activation email:", error);
    throw error;
  }
}

module.exports = sendAccountActivationEmail;
