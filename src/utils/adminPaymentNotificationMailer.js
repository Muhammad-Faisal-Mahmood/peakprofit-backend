const path = require("path");
const { sendEmail } = require("../shared/mail.service");
const formatDate = require("./formatDate");

const sendPaymentNotification = async (payment) => {
  // Helper function to format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  // Helper function to format large numbers with commas
  const formatNumber = (num) => {
    return new Intl.NumberFormat("en-US").format(num || 0);
  };

  // Get payment icon based on payment method type
  const getPaymentIcon = () => {
    switch (payment.paymentMethodType) {
      case "card":
        return "💳";
      case "bank_account":
        return "🏦";
      default:
        return "💰";
    }
  };

  // Build card/bank number mask
  const getCardNumberMask = () => {
    if (payment.card?.last4) {
      return `•••• •••• •••• ${payment.card.last4}`;
    }
    if (payment.bank?.accountNumberMasked) {
      return `••••${payment.bank.accountNumberMasked.slice(-4)}`;
    }
    return "N/A";
  };

  // Get card brand or bank account type
  const getPaymentMethodLabel = () => {
    if (payment.card?.brand) {
      return payment.card.brand;
    }
    if (payment.bank?.accountType) {
      return (
        payment.bank.accountType.charAt(0).toUpperCase() +
        payment.bank.accountType.slice(1)
      );
    }
    return "Payment Method";
  };

  // Access populated or direct fields
  const user = payment.userId || {};
  const challenge = payment.challengeId || {};
  const account = payment.accountId || {};

  // Build the replacements object dynamically from payment data
  const replacements = {
    // ==================== PAYMENT INFORMATION ====================
    status: payment.status
      ? payment.status.charAt(0).toUpperCase() + payment.status.slice(1)
      : "N/A",
    currency: payment.currency === "USD" ? "$" : payment.currency || "$",
    amount: formatCurrency(payment.authAmount),
    transactionId: payment.transactionId || "N/A",
    invoiceNumber: payment.invoiceNumber || "N/A",
    authCode: payment.authCode || "N/A",
    responseDescription: payment.responseReasonDescription || "N/A",
    networkTransId: payment.networkTransId || "N/A",
    paymentMethod: payment.paymentMethodType,

    // ==================== CUSTOMER INFORMATION ====================
    userName: user.name || "N/A",
    userEmail: user.email || "N/A",
    userId: user._id?.toString() || "N/A",

    // ==================== PAYMENT METHOD DETAILS ====================
    paymentIcon: getPaymentIcon(),
    cardBrand: getPaymentMethodLabel(),
    cardNumber: getCardNumberMask(),

    // ==================== CHALLENGE INFORMATION ====================
    challengeName: challenge.name || "N/A",
    accountSize: formatNumber(challenge.accountSize),

    // ==================== ACCOUNT INFORMATION ====================
    accountId: account._id?.toString() || "N/A",
    accountType: account.accountType
      ? account.accountType.charAt(0).toUpperCase() +
        account.accountType.slice(1)
      : "N/A",
    initialBalance: formatCurrency(account.initialBalance),
    currentBalance: formatCurrency(account.balance),
    equity: formatCurrency(account.equity),

    // ==================== ADDITIONAL DETAILS ====================
    customerIP: payment.customerIP || "N/A",
    transactionDateUTC: formatDate(payment.submitTimeUTC),
    transactionDateLocal: formatDate(payment.submitTimeLocal),
    billingCountry: payment.billingAddress?.country || "N/A",
    processedBy: payment?.metadata?.provider,

    // ==================== FOOTER ====================
    year: new Date().getFullYear().toString(),
    companyName: process.env.COMPANY_NAME || "PeakProfitFunding",
  };

  const template = path.join(
    __dirname,
    "mails",
    "AdminPaymentNotification.html"
  );

  try {
    await sendEmail(
      `💰 Payment Received: ${user.name || "Customer"} - ${
        replacements.currency
      }${replacements.amount}`,
      template,
      process.env.ADMIN_EMAIL,
      replacements
    );
    console.log("✅ Payment notification email sent to admin");
  } catch (error) {
    console.error("❌ Failed to send payment notification email:", error);
    throw error;
  }
};

module.exports = sendPaymentNotification;
