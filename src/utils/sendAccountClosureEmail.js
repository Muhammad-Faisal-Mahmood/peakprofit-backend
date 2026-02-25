const { sendEmail } = require("../shared/mail.service");
const path = require("path");
const logoPath = require("../constants/logoPath");
async function sendAccountClosureEmail(account, violationRule) {
  try {
    const user = account.userId;

    if (!user || !user.email) {
      throw new Error("User email not found");
    }

    // Extract first name from full name or use email username
    const firstName = user.name
      ? user.name.split(" ")[0]
      : user.email.split("@")[0];

    // Determine breach type and violation reason
    let breachType;
    let violationReason;

    switch (violationRule) {
      case "dailyDrawdown":
        breachType = "Daily Drawdown Limit";
        const dailyDDPercent = 2.5;
        violationReason = `You exceeded the ${dailyDDPercent}% daily loss limit. Your account equity dropped below the allowed daily threshold.`;
        break;

      case "maxDrawdown":
        breachType = "Maximum Drawdown Limit";
        const maxDDPercent = 7;
        violationReason = `You exceeded the ${maxDDPercent}% overall drawdown limit. Your account equity dropped below the maximum allowed threshold.`;
        break;

      default:
        breachType = "Rule Violation";
        violationReason =
          "Your account breached evaluation rules and has been closed.";
    }

    // Format breach time
    const breachTime = new Date().toLocaleString("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    // Format account size and current balance
    const accountCurrency = "USD"; // Adjust based on your system
    const formattedAccountSize = `$${account.initialBalance.toLocaleString()}`;
    const formattedCurrentBalance = `$${account.equity.toFixed(2)}`;

    // Determine account type display name
    const accountTypeDisplay =
      account.accountType === "demo"
        ? "Demo Account"
        : account.accountType === "funded"
          ? "Funded Account"
          : "Evaluation Account";

    // Calculate rule percentages
    const dailyDD = 2.5;
    const maxDD = 7;
    const profitTarget = 8;

    const replacements = {
      first_name: firstName,
      email: user.email,
      account_size: formattedAccountSize,
      account_currency: accountCurrency,
      account_type: accountTypeDisplay,
      current_balance: formattedCurrentBalance,
      breach_type: breachType,
      violation_reason: violationReason,
      breach_time: breachTime,
      daily_dd: dailyDD,
      max_dd: maxDD,
      profit_target: profitTarget,
      min_trading_days: account.minTradingDays || 5,
      year: new Date().getFullYear(),
      unsubscribe_url: "#", // Placeholder until unsubscribe functionality is implemented
      logoUrl: logoPath,
    };

    const template = path.join(__dirname, "mails", "AccountFailed.html");

    await sendEmail(
      "Evaluation Account Closed – Rule Violation ⚠",
      template,
      user.email,
      replacements,
    );

    console.log(
      `[LIQUIDATION] Account closure email sent to ${user.email} (Breach: ${breachType})`,
    );
  } catch (error) {
    console.error("Error sending account closure email:", error);
    throw error;
  }
}

module.exports = sendAccountClosureEmail;
