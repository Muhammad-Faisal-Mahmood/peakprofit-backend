const express = require("express");
const crypto = require("crypto");
const Payment = require("../payment/payment.model");
const challengeBuyingService = require("../utils/challengeBuying.service");
const PaymentSession = require("./paymentSession/paymentSession.model");

const router = express.Router();

const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET;

/**
 * IMPORTANT:
 * Use express.raw — signature depends on raw body
 */
router.post(
  "/webhook/nowpayments",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    console.log("📡 NOWPayments webhook received");

    const rawBody = req.body;
    console.log("rawBody: ", rawBody);
    const signature = req.headers["x-nowpayments-sig"];

    if (!signature) {
      console.log("❌ Missing signature");
      return res.status(400).send("Missing signature");
    }

    /* -------------------- SIGNATURE VERIFICATION -------------------- */
    const expectedSignature = crypto
      .createHmac("sha512", NOWPAYMENTS_IPN_SECRET)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      console.log("❌ Invalid signature");
      return res.status(400).send("Invalid signature");
    }

    console.log("✅ Signature verified");

    let event;

    try {
      event = JSON.parse(rawBody.toString());
    } catch (err) {
      console.log("❌ Invalid JSON");
      return res.status(400).send("Invalid JSON");
    }

    console.log("event data: ", event);

    console.log("📦 Event:", event.payment_status, event.order_id);

    try {
      await handleNowPaymentsEvent(event);

      // ALWAYS return 200 to avoid retries
      return res.status(200).send("OK");
    } catch (err) {
      console.error("❌ Processing error:", err);

      // Still return 200 → prevents infinite retries
      return res.status(200).send("OK");
    }
  },
);

async function handleNowPaymentsEvent(event) {
  const {
    order_id,
    payment_status,
    pay_amount,
    price_amount,
    pay_currency,
    actually_paid,
  } = event;

  if (!order_id) {
    console.log("⚠️ Missing order_id");
    return;
  }

  const payment = await Payment.findById(order_id);

  if (!payment) {
    console.log("⚠️ Payment not found:", order_id);
    return;
  }

  console.log("💳 Found payment:", payment._id);

  /* -------------------- IDEMPOTENCY -------------------- */
  const FINAL_STATUSES = ["accepted", "failed"];
  if (FINAL_STATUSES.includes(payment.status)) {
    console.log("⚠️ Already processed:", payment.status);
    return;
  }

  /* -------------------- STORE RAW DATA -------------------- */
  payment.metadata = {
    ...payment.metadata,
    nowpayments: event,
  };

  let session = null;
  if (payment.sessionId) {
    session = await PaymentSession.findById(payment.sessionId);
  }

  /* -------------------- STATUS HANDLING -------------------- */
  const SLIPPAGE = 0.98;
  switch (payment_status) {
    case "partially_paid":
    case "finished":
    case "confirmed": {
      const actuallyPaid = Number(event.actually_paid);
      const expected = payment.metadata?.crypto?.expectedAmountCrypto;

      if (!expected) {
        console.log("❌ Missing expected crypto amount");
        return;
      }

      /* -------------------- STORE ACTUAL PAID -------------------- */
      payment.metadata.crypto.actuallyPaidCrypto = actuallyPaid;

      /* -------------------- CHECK WITH SLIPPAGE -------------------- */
      if (actuallyPaid >= expected * SLIPPAGE) {
        console.log("✅ Payment meets threshold");

        payment.status = "accepted";
        payment.settledAmount = actuallyPaid;

        await payment.save();
        if (session) {
          session.status = "completed";
          session.expiresAt = new Date(); // mark session as done
          await session.save();
        }
        await handleSuccessfulPayment(payment);
      } else {
        console.log("⚠️ Still underpaid");

        payment.status = "partial"; // introduce this status
        await payment.save();
      }

      break;
    }

    case "failed":
    case "expired": {
      console.log("❌ Payment failed/expired");

      payment.status = "failed";
      await payment.save();
      if (session) {
        session.status = "failed";
        session.expiresAt = new Date();
        await session.save();
      }
      break;
    }

    case "waiting":
    case "confirming":
    case "sending": {
      console.log("⏳ Payment in progress:", payment_status);

      // Do nothing, still pending
      break;
    }

    default:
      console.log("ℹ️ Unknown status:", payment_status);
  }
}

async function handleSuccessfulPayment(payment) {
  console.log("🎯 Granting challenge access");

  const result = await challengeBuyingService(
    payment.challengeId,
    payment.userId,
  );

  if (result?.account?._id) {
    await Payment.updateOne(
      { _id: payment._id },
      {
        $set: {
          accountId: result.account._id,
          updatedAt: new Date(),
        },
      },
    );

    console.log("🔗 Account linked:", result.account._id);
  }
}

module.exports = router;
