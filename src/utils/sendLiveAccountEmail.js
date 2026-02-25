const Account = require("../trade/account/account.model");
const User = require("../user/user.model");
const { sendEmail } = require("../shared/mail.service");
const { generateCertificate } = require("./certificateGenerator.service");
const path = require("path");
const fs = require("fs");
const logoPath = require("../constants/logoPath");

/**
 * Send funded account email with personalized certificate
 * Call this when user passes evaluation and receives funded account
 */
async function sendLiveAccountEmail(fundedAccountId) {
  try {
    // Get funded account with user data
    const fundedAccount = await Account.findById(fundedAccountId).populate(
      "userId",
      "name email",
    );

    if (!fundedAccount) {
      throw new Error("Funded account not found");
    }

    const user = fundedAccount.userId;

    if (!user || !user.email) {
      throw new Error("User email not found");
    }

    // Extract first name
    const firstName = user.name
      ? user.name.split(" ")[0]
      : user.email.split("@")[0];

    // Format dates
    const fundedStartDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Calculate first payout date (e.g., 14 days from now)
    const firstPayoutDate = new Date();
    firstPayoutDate.setDate(firstPayoutDate.getDate() + 14);
    const formattedFirstPayoutDate = firstPayoutDate.toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      },
    );

    // Format account details
    const accountCurrency = "USD";
    const formattedAccountSize = `$${fundedAccount.initialBalance.toLocaleString()}`;
    const accountTypeDisplay = "Funded Account";

    // Server name
    const serverName = process.env.TRADING_SERVER_NAME || "PeakMarkets-Live";

    // Calculate rule percentages
    const dailyDD = 2.5;
    const maxDD = 7;

    // Payout details (customize based on your business model)
    const payoutSplit = "80/20"; // 80% to trader, 20% to firm
    const payoutCycle = "weekly"; // or "Monthly", "Weekly"

    // Leverage
    const leverage = `1:${fundedAccount.leverage}`;

    // Generate certificate
    console.log("Generating certificate...");
    const certificateDate = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });

    const certificateData = {
      traderName: user.name || user.email.split("@")[0],
      accountSize: formattedAccountSize,
      date: certificateDate,
      userId: user._id.toString(),
    };

    const certificatePath = await generateCertificate(certificateData);

    // Read certificate as base64 for embedding
    const publicPathSegment = certificatePath
      .split(path.sep)
      .slice(-3)
      .join("/"); // Should result in 'uploads/certificates/certificate_....jpg'

    // 2. Construct the full download URL using the environment variable and the public path.
    const backendUrl =
      process.env.BACKEND_URL || "https://api.peakprofitfunding.com";
    // Ensure backendUrl doesn't end with a slash, and publicPathSegment doesn't start with one.
    const certificateDownloadUrl = `${backendUrl}/${publicPathSegment}`;

    // Example: https://api.peakprofitfunding.com/uploads/certificates/certificate_....jpg

    // Read certificate as base64 for embedding (this part is correct for embedding)
    const certificateBuffer = fs.readFileSync(certificatePath);
    const certificateBase64 = certificateBuffer.toString("base64");
    const certificateDataUrl = `data:image/jpeg;base64,${certificateBase64}`;

    const replacements = {
      first_name: firstName,
      email: user.email,
      funded_account_size: formattedAccountSize,
      funded_account_currency: accountCurrency,
      funded_account_type: accountTypeDisplay,
      server_name: serverName,
      funded_start_date: fundedStartDate,
      leverage: leverage,
      payout_split: payoutSplit,
      payout_cycle: payoutCycle,
      first_payout_date: formattedFirstPayoutDate,
      daily_dd: dailyDD,
      max_dd: maxDD,
      year: new Date().getFullYear(),
      unsubscribe_url: "#",
      certificate_image_url: certificateDataUrl, // Embedded certificate
      certificate_download_url: certificateDownloadUrl,
      logoUrl: logoPath,
    };

    const template = path.join(__dirname, "mails", "AccountPassed.html");

    // Attach certificate as file
    const attachments = [
      {
        filename: `PeakProfit_Certificate_${
          user.name?.replace(/\s+/g, "_") || "Trader"
        }.jpg`,
        path: certificatePath,
        cid: "certificate@peakprofit", // CID for inline embedding
      },
    ];

    await sendEmail(
      "You've Passed – Your Funded Account Is Ready 🎉",
      template,
      user.email,
      replacements,
      null, // html (template will be used)
      attachments,
    );

    console.log(`Funded account email with certificate sent to ${user.email}`);

    // Optional: Clean up certificate file after a delay (or keep for records)
    // setTimeout(() => {
    //   if (fs.existsSync(certificatePath)) {
    //     fs.unlinkSync(certificatePath);
    //   }
    // }, 60000); // Delete after 1 minute

    return certificatePath;
  } catch (error) {
    console.error("Error sending funded account email:", error);
    throw error;
  }
}

/**
 * Example: Call this when user passes evaluation
 */

module.exports = sendLiveAccountEmail;
