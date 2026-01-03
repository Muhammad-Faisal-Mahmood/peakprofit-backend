const express = require("express");
const crypto = require("crypto");
const Payment = require("../payment/payment.model");
const challengeBuyingService = require("../utils/challengeBuying.service");

const router = express.Router();

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

    // Try multiple signature generation methods
    console.log("\n🧪 Testing different signature methods:");

    // Method 1: Original (hex decode the key)
    const sig1 =
      "sha512=" +
      crypto
        .createHmac("sha512", Buffer.from(SIGNATURE_KEY, "hex"))
        .update(rawBody)
        .digest("hex");
    console.log("1️⃣ With hex decoded key:", sig1);

    // Method 2: Use key as-is (UTF-8 string)
    const sig2 =
      "sha512=" +
      crypto.createHmac("sha512", SIGNATURE_KEY).update(rawBody).digest("hex");
    console.log("2️⃣ With raw string key:", sig2);

    // Method 3: Try with UTF-8 encoded body
    const sig3 =
      "sha512=" +
      crypto
        .createHmac("sha512", Buffer.from(SIGNATURE_KEY, "hex"))
        .update(rawBody.toString("utf8"))
        .digest("hex");
    console.log("3️⃣ With UTF-8 body string:", sig3);

    // Method 4: Double-check the received signature format
    console.log("\n📨 Received signature:", signatureHeader);
    console.log("📨 Received (lowercase):", signatureHeader.toLowerCase());

    // Check which method matches
    const receivedLower = signatureHeader.toLowerCase();
    let isValid = false;
    let matchedMethod = null;

    if (receivedLower === sig1.toLowerCase()) {
      isValid = true;
      matchedMethod = "Method 1 (hex decoded key)";
    } else if (receivedLower === sig2.toLowerCase()) {
      isValid = true;
      matchedMethod = "Method 2 (raw string key)";
    } else if (receivedLower === sig3.toLowerCase()) {
      isValid = true;
      matchedMethod = "Method 3 (UTF-8 body)";
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
    console.log("🔥 Event Type:", event.eventType);
    console.log("payload:", event.payload);
    console.log("event body:", event);

    try {
      switch (event.eventType) {
        case "net.authorize.payment.authcapture.created":
          await handlePaymentSucceeded(event.payload);
          break;

        case "net.authorize.payment.authcapture.failed":
          await handlePaymentFailed(event.payload);
          break;

        case "net.authorize.payment.refund.created":
          await handleRefund(event.payload);
          break;

        case "net.authorize.payment.void.created":
          await handleVoid(event.payload);
          break;

        default:
          console.log("ℹ️ Unhandled event:", event.eventType);
      }

      res.status(200).send("OK");
    } catch (err) {
      console.error("❌ Webhook error:", err);
      res.status(200).send("OK");
    }
  }
);

const ApiContracts = require("authorizenet").APIContracts;
const ApiControllers = require("authorizenet").APIControllers;
const SDKConstants = require("authorizenet").Constants;

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

async function handlePaymentSucceeded(payload) {
  const transactionId = payload.id;

  console.log("💰 Payment succeeded:", transactionId);
  console.log("📞 Fetching full transaction details...");

  try {
    // Fetch complete transaction details
    const fullTransaction = await getTransactionDetails(transactionId);
    console.log("full transaction: ", fullTransaction);
    const amount = fullTransaction.getAuthAmount();
    const currency = "USD";

    // Get metadata from order description
    const orderDescription = fullTransaction.getOrder()?.getDescription();
    const userId = orderDescription?.match(/User:(\w+)/)?.[1];
    const challengeId = orderDescription?.match(/Challenge:(\w+)/)?.[1];

    // Get card details
    const cardLast4 = fullTransaction
      .getPayment()
      ?.getCreditCard()
      ?.getCardNumber()
      ?.slice(-4);
    const cardType = fullTransaction
      .getPayment()
      ?.getCreditCard()
      ?.getCardType();

    console.log("🎯 Challenge ID:", challengeId);
    console.log("👤 User ID:", userId);
    console.log("💳 Card:", cardType, "****" + cardLast4);

    const payment = await Payment.findOneAndUpdate(
      { transactionId },
      {
        transactionId,
        status: "succeeded",
        amount,
        currency,
        userId,
        challengeId,
        cardLast4,
        cardType,
        createdAt: new Date(fullTransaction.getSubmitTimeUTC()),
        rawPayload: payload,
      },
      { upsert: true, new: true }
    );

    console.log("✅ Payment saved:", payment._id);

    if (userId && challengeId) {
      await challengeBuyingService(challengeId, userId, "authorize-net");
    }
  } catch (error) {
    console.error("❌ Error fetching transaction details:", error);
    throw error;
  }
}

async function handlePaymentFailed(payload) {
  const transaction = payload.transaction;

  await Payment.findOneAndUpdate(
    { transactionId: transaction.id },
    {
      transactionId: transaction.id,
      status: "failed",
      failureReason: transaction.responseReasonDescription,
      rawPayload: payload,
    },
    { upsert: true }
  );

  console.log("❌ Payment failed:", transaction.id);
}

async function handleRefund(payload) {
  const transaction = payload.transaction;

  await Payment.findOneAndUpdate(
    { transactionId: transaction.refTransId },
    {
      status: "refunded",
      refundedAmount: transaction.authAmount,
      refundedAt: new Date(),
    }
  );

  console.log("🔄 Payment refunded:", transaction.refTransId);
}

async function handleVoid(payload) {
  const transaction = payload.transaction;

  await Payment.findOneAndUpdate(
    { transactionId: transaction.originalTransId },
    {
      status: "voided",
      voidedAt: new Date(),
    }
  );

  console.log("❌ Payment voided:", transaction.originalTransId);
}

module.exports = router;
