const express = require("express");
const crypto = require("crypto");
const Payment = require("../payment/payment.model");
const challengeBuyingService = require("../utils/challengeBuying.service");

const router = express.Router();
const ApiContracts = require("authorizenet").APIContracts;
const ApiControllers = require("authorizenet").APIControllers;
const SDKConstants = require("authorizenet").Constants;

const SIGNATURE_KEY = process.env.AUTHORIZE_NET_SIGNATURE_KEY;

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    console.log("📡 Authorize.Net webhook received");
    console.log("🔍 Content-Type:", req.headers["content-type"]);
    console.log("🔍 Body type:", typeof req.body);
    console.log("🔍 Body is Buffer:", Buffer.isBuffer(req.body));
    console.log("🔍 Body length:", req.body?.length);

    const rawBody = req.body;
    const signatureHeader = req.headers["x-anet-signature"];

    if (!signatureHeader) {
      console.log("❌ Missing signature header");
      return res.status(400).send("Missing signature");
    }

    // Log the actual payload for debugging
    console.log(
      "📦 Raw body (first 200 chars):",
      rawBody.toString().substring(0, 200)
    );

    // Method 2: Use key as-is (UTF-8 string)
    const sig2 =
      "sha512=" +
      crypto.createHmac("sha512", SIGNATURE_KEY).update(rawBody).digest("hex");
    console.log("2️⃣ With raw string key:", sig2);

    // Method 4: Double-check the received signature format
    console.log("\n📨 Received signature:", signatureHeader);
    console.log("📨 Received (lowercase):", signatureHeader.toLowerCase());

    // Check which method matches
    const receivedLower = signatureHeader.toLowerCase();
    let isValid = false;
    let matchedMethod = null;

    if (receivedLower === sig2.toLowerCase()) {
      isValid = true;
      matchedMethod = "Method 2 (raw string key)";
    }

    if (!isValid) {
      console.log("❌ Invalid signature - no methods matched");
      console.log("💡 Check if:");
      console.log("   - The signature key in .env is correct");
      console.log("   - There's no middleware modifying the body");
      console.log("   - The webhook URL in Authorize.Net is correct");
      return res.status(400).send("Invalid signature");
    }

    console.log("✅ Signature verified using:", matchedMethod);

    const event = JSON.parse(rawBody.toString());

    try {
      switch (event.eventType) {
        case "net.authorize.payment.authcapture.created":
          await handlePaymentAccepted(event.payload);
          break;

        case "net.authorize.payment.authcapture.failed":
          await handlePaymentFailed(event.payload);
          break;

        default:
          console.log("ℹ️ Ignored event:", event.eventType);
      }

      res.status(200).send("OK");
    } catch (err) {
      console.error("❌ Webhook processing error:", err);
      res.status(200).send("OK"); // prevent retries
    }
  }
);

async function getTransactionDetails(transactionId) {
  return new Promise((resolve, reject) => {
    const merchantAuthenticationType =
      new ApiContracts.MerchantAuthenticationType();
    merchantAuthenticationType.setName(process.env.AUTHORIZE_NET_API_LOGIN_ID);
    merchantAuthenticationType.setTransactionKey(
      process.env.AUTHORIZE_NET_TRANSACTION_KEY
    );

    const getRequest = new ApiContracts.GetTransactionDetailsRequest();
    getRequest.setMerchantAuthentication(merchantAuthenticationType);
    getRequest.setTransId(transactionId);

    const ctrl = new ApiControllers.GetTransactionDetailsController(
      getRequest.getJSON()
    );

    const environment =
      process.env.AUTHORIZE_NET_ENVIRONMENT === "production"
        ? SDKConstants.endpoint.production
        : SDKConstants.endpoint.sandbox;

    ctrl.setEnvironment(environment);

    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();
      const response = new ApiContracts.GetTransactionDetailsResponse(
        apiResponse
      );

      if (
        response.getMessages().getResultCode() ===
        ApiContracts.MessageTypeEnum.OK
      ) {
        resolve(response.getTransaction());
      } else {
        reject(new Error(response.getMessages().getMessage()[0].getText()));
      }
    });
  });
}

async function handlePaymentAccepted(payload) {
  const transactionId = payload.id;

  console.log("💰 Payment accepted:", transactionId);

  const fullTransaction = await getTransactionDetails(transactionId);
  console.log("transaction details:", fullTransaction);

  const invoiceNumber = fullTransaction.getOrder()?.getInvoiceNumber();

  if (!invoiceNumber) {
    throw new Error("Missing invoice number in transaction");
  }

  const payment = await Payment.findOne({ invoiceNumber });

  if (!payment) {
    throw new Error(`Payment not found for invoice ${invoiceNumber}`);
  }

  if (payment.status !== "pending") {
    console.log(`⚠️ Payment already processed with status: ${payment.status}`);
    return; // Don't throw, just skip
  }

  // Extract all available information
  const paymentInfo = fullTransaction.getPayment();
  const creditCard = paymentInfo?.getCreditCard();
  const bankAccount = paymentInfo?.getBankAccount();
  const billTo = fullTransaction.getBillTo();
  const order = fullTransaction.getOrder();

  const update = {
    // -------------------- STATUS & IDS --------------------
    status: "accepted",
    transactionId: String(transactionId),

    // -------------------- AMOUNTS --------------------
    authAmount: fullTransaction.getAuthAmount(),
    settledAmount: fullTransaction.getSettleAmount(),

    // -------------------- RESPONSE INFO --------------------
    responseCode: fullTransaction.getResponseCode(),
    responseReasonCode: fullTransaction.getResponseReasonCode(),
    responseReasonDescription: fullTransaction.getResponseReasonDescription(),
    authCode: fullTransaction.getAuthCode(),
    avsResponse: fullTransaction.getAVSResponse(),
    cardCodeResponse: fullTransaction.getCardCodeResponse(),

    // -------------------- PAYMENT METHOD --------------------
    paymentMethodType: creditCard
      ? "card"
      : bankAccount
      ? "bank_account"
      : undefined,

    // -------------------- CARD INFO --------------------
    ...(creditCard && {
      card: {
        brand: creditCard.getCardType(),
        last4: creditCard.getCardNumber()?.slice(-4),
        expirationDate: creditCard.getExpirationDate(),
      },
    }),

    // -------------------- BANK INFO --------------------
    ...(bankAccount && {
      bank: {
        accountType: bankAccount.getAccountType(),
        routingNumberMasked: bankAccount.getRoutingNumber(),
        accountNumberMasked: bankAccount.getAccountNumber(),
        nameOnAccount: bankAccount.getNameOnAccount(),
        bankName: bankAccount.getBankName(),
      },
    }),

    // -------------------- BILLING ADDRESS --------------------
    ...(billTo && {
      billingAddress: {
        firstName: billTo.getFirstName(),
        lastName: billTo.getLastName(),
        address: billTo.getAddress(),
        city: billTo.getCity(),
        state: billTo.getState(),
        zip: billTo.getZip(),
        country: billTo.getCountry(),
        phoneNumber: billTo.getPhoneNumber(),
      },
    }),

    // -------------------- ORDER INFO --------------------
    orderDescription: order?.getDescription(),

    // -------------------- NETWORK & TRANSACTION META --------------------
    customerIP: fullTransaction.getCustomerIP(),
    networkTransId: fullTransaction.getNetworkTransId(),
    marketType: fullTransaction.getMarketType(),
    product: fullTransaction.getProduct(),

    // -------------------- TIMESTAMPS --------------------
    submitTimeUTC: new Date(fullTransaction.getSubmitTimeUTC()),
    submitTimeLocal: fullTransaction.getSubmitTimeLocal(),

    // -------------------- INTERNAL --------------------
    updatedAt: new Date(),
  };

  console.log("📝 Updates to be applied:", JSON.stringify(update, null, 2));

  const updatedPayment = await Payment.updateOne(
    { _id: payment._id },
    { $set: update }
  );

  console.log("✅ Payment update result:", updatedPayment);

  if (updatedPayment.modifiedCount === 0) {
    console.warn("⚠️ No documents were modified");
  }

  // Fetch the updated payment to confirm
  const confirmedPayment = await Payment.findById(payment._id);
  console.log("✅ Payment confirmed as accepted:", {
    invoiceNumber: confirmedPayment.invoiceNumber,
    status: confirmedPayment.status,
    transactionId: confirmedPayment.transactionId,
    amount: confirmedPayment.authAmount,
  });

  // 🎯 Grant challenge access
  const result = await challengeBuyingService(
    payment.challengeId,
    payment.userId
  );

  if (result && result?.account?._id) {
    await Payment.updateOne(
      { _id: payment._id },
      {
        $set: {
          accountId: result.account._id,
          updatedAt: new Date(),
        },
      }
    );

    console.log("🔗 Account linked to payment:", {
      paymentId: payment._id,
      accountId: result.account._id,
    });
  }
}

async function handlePaymentFailed(payload) {
  try {
    const transactionId = payload?.id;

    console.log("❌ Payment failed:", transactionId);

    const fullTransaction = await getTransactionDetails(transactionId);
    console.log("failed transaction details:", fullTransaction);
    const invoiceNumber = fullTransaction.getOrder()?.getInvoiceNumber();

    if (!invoiceNumber) return;

    await Payment.updateOne(
      { invoiceNumber },
      {
        status: "failed",
        transactionId: String(transactionId),
        updatedAt: new Date(),
      }
    );
  } catch (error) {
    throw new Error("Couldnt handle payment failure", error.message);
  }
}

module.exports = router;
