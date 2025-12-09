const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const createAccount = require("../utils/createAccount");
const Payment = require("../payment/payment.model");
const WHOP_WEBHOOK_SECRET = process.env.WHOP_WEBHOOK_SECRET;

router.post(
  "/webhook",
  express.raw({ type: "application/json" }), // IMPORTANT
  async (req, res) => {
    console.log("webhook called");
    const rawBody = req.body;
    console.log("Incoming headers:", req.headers);

    // Whop uses Svix signature format
    const signature = req.headers["webhook-signature"];
    const timestamp = req.headers["webhook-timestamp"];
    const webhookId = req.headers["webhook-id"];

    // Verify signature
    const signedContent = `${webhookId}.${timestamp}.${rawBody.toString()}`;
    const secret = WHOP_WEBHOOK_SECRET.startsWith("whsec_")
      ? WHOP_WEBHOOK_SECRET.slice(6)
      : WHOP_WEBHOOK_SECRET;

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(signedContent)
      .digest("base64");

    // Signature comes as "v1,signature" - extract the signature part
    const providedSignature = signature.split(",")[1];

    if (providedSignature !== expectedSignature) {
      console.log("❌ Invalid webhook signature");
      console.log("Received:", providedSignature);
      console.log("Expected:", expectedSignature);
      return res.status(400).send("Invalid signature");
    }

    console.log("✅ Signature verified");

    const event = JSON.parse(rawBody.toString());

    console.log("🔥 WHOP EVENT:", event.type);
    console.log("📦 Event data:", JSON.stringify(event.data, null, 2));

    try {
      // Handle different event types
      switch (event.type) {
        case "membership.activated":
          console.log("🎉 New membership activated!");
          await handleMembershipActivated(event.data);
          break;

        case "payment.succeeded":
          console.log("💰 Payment succeeded");
          await handlePaymentSucceeded(event.data);
          break;

        case "payment.failed":
          console.log("⚠️ Payment failed");
          await handlePaymentFailed(event.data);
          break;

        default:
          console.log("ℹ️ Unhandled event type:", event.type);
      }

      res.status(200).send("OK");
    } catch (error) {
      console.error("❌ Error processing webhook:", error);
      // Still return 200 to prevent Whop from retrying
      res.status(200).send("OK");
    }
  }
);

// Handler functions
async function handleMembershipActivated(data) {
  console.log("📋 Processing membership activation...");

  const userId = data.metadata?.userId;
  const whopMembershipId = data.id;
  const whopUserId = data.user.id;
  const planId = data.plan.id;
  const productId = data.product.id;
  const challengeId = data.metadata?.challengeId;

  console.log("👤 User ID (from metadata):", userId);
  console.log("🆔 Whop Membership ID:", whopMembershipId);
  console.log("👥 Whop User ID:", whopUserId);
  console.log("📦 Plan ID:", planId);
  console.log("🏷️ Product ID:", productId);

  if (!userId) {
    console.warn("⚠️ No userId in metadata - using Whop user ID instead");
    // You might need to look up your user by whopUserId or email
  }

  try {
    const account = await createAccount({
      userId: userId,
      challengeId: challengeId,
      accountType: "demo",
    });
    console.log("account created");
  } catch (error) {
    console.log("error in creating account: ", error.message);
    throw error;
  }

  // TODO: Update your database
  // Example:
  // await User.findByIdAndUpdate(userId, {
  //   subscriptionStatus: "active",
  //   whopMembershipId: whopMembershipId,
  //   whopUserId: whopUserId,
  //   subscriptionPlanId: planId,
  //   subscriptionExpiresAt: new Date(expiresAt * 1000),
  //   subscriptionCancelAtPeriodEnd: cancelAtPeriodEnd,
  // });

  console.log("✅ Membership activation processed");
}

async function handlePaymentSucceeded(data) {
  console.log("📋 Processing successful payment...");

  const userId = data.metadata?.userId;
  const challengeId = data.metadata?.challengeId;
  const paymentId = data.id;
  const amount = data.total;
  const currency = data.currency;

  console.log("👤 User ID:", userId);
  console.log("💰 Payment ID:", paymentId);
  console.log("💵 Amount:", amount, currency.toUpperCase());

  try {
    // Create or update payment record
    const payment = await Payment.findOneAndUpdate(
      { whopPaymentId: paymentId },
      {
        whopPaymentId: paymentId,
        status: data.status,
        substatus: "succeeded",
        userId: userId,
        challengeId: challengeId,

        // Whop references
        whopUserId: data.user.id,
        whopMembershipId: data.membership?.id,
        whopMemberId: data.member?.id,
        membershipStatus: data.membership?.status,

        // Product info
        productId: data.product.id,
        productTitle: data.product.title,
        planId: data.plan.id,

        // Amounts
        total: data.total,
        subtotal: data.subtotal,
        usdTotal: data.usd_total,
        refundedAmount: data.refunded_amount,
        amountAfterFees: data.amount_after_fees,
        currency: data.currency,

        // Payment method
        paymentMethodId: data.payment_method?.id,
        paymentMethodType: data.payment_method_type,
        cardBrand: data.card_brand,
        cardLast4: data.card_last4,
        cardExpMonth: data.payment_method?.card?.exp_month,
        cardExpYear: data.payment_method?.card?.exp_year,

        // Billing address
        billingAddress: data.billing_address
          ? {
              name: data.billing_address.name,
              line1: data.billing_address.line1,
              line2: data.billing_address.line2,
              city: data.billing_address.city,
              state: data.billing_address.state,
              postalCode: data.billing_address.postal_code,
              country: data.billing_address.country,
            }
          : undefined,

        // User info
        userEmail: data.user.email,
        userName: data.user.name,
        userPhone: data.member?.phone,

        // Flags
        refundable: data.refundable,
        retryable: data.retryable,
        voidable: data.voidable,
        autoRefunded: data.auto_refunded,

        // Billing info
        billingReason: data.billing_reason,
        promoCode: data.promo_code,

        // Timestamps
        createdAt: data.created_at ? new Date(data.created_at) : undefined,
        paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
        lastPaymentAttempt: data.last_payment_attempt
          ? new Date(data.last_payment_attempt)
          : undefined,

        // Metadata
        metadata: data.metadata,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    console.log("✅ Payment record saved:", payment._id);

    // Create account for the user
    if (userId && challengeId) {
      await createAccount({
        userId,
        challengeId,
        accountType: "demo",
      });
      console.log("✅ Account created for user");
    }

    console.log("✅ Payment processed successfully");
  } catch (error) {
    console.error("❌ Error saving payment:", error);
    throw error;
  }
}

async function handlePaymentFailed(data) {
  console.log("📋 Processing failed payment...");

  const userId = data.metadata?.userId;
  const challengeId = data.metadata?.challengeId;
  const paymentId = data.id;
  const failureReason = data.failure_message;

  console.log("👤 User ID:", userId);
  console.log("💰 Payment ID:", paymentId);
  console.log("❌ Failure reason:", failureReason);

  try {
    // Create or update payment record
    const payment = await Payment.findOneAndUpdate(
      { whopPaymentId: paymentId },
      {
        whopPaymentId: paymentId,
        status: data.status,
        substatus: "failed",
        userId: userId,
        challengeId: challengeId,

        // Whop references
        whopUserId: data.user.id,
        whopMembershipId: data.membership?.id,
        whopMemberId: data.member?.id,
        membershipStatus: data.membership?.status,

        // Product info
        productId: data.product.id,
        productTitle: data.product.title,
        planId: data.plan.id,

        // Amounts
        total: data.total,
        subtotal: data.subtotal,
        usdTotal: data.usd_total,
        refundedAmount: data.refunded_amount,
        amountAfterFees: data.amount_after_fees,
        currency: data.currency,

        // Payment method
        paymentMethodId: data.payment_method?.id,
        paymentMethodType: data.payment_method_type,
        cardBrand: data.card_brand,
        cardLast4: data.card_last4,
        cardExpMonth: data.payment_method?.card?.exp_month,
        cardExpYear: data.payment_method?.card?.exp_year,

        // Billing address
        billingAddress: data.billing_address
          ? {
              name: data.billing_address.name,
              line1: data.billing_address.line1,
              line2: data.billing_address.line2,
              city: data.billing_address.city,
              state: data.billing_address.state,
              postalCode: data.billing_address.postal_code,
              country: data.billing_address.country,
            }
          : undefined,

        // User info
        userEmail: data.user.email,
        userName: data.user.name,
        userPhone: data.member?.phone,

        // Flags
        refundable: data.refundable,
        retryable: data.retryable,
        voidable: data.voidable,
        autoRefunded: data.auto_refunded,

        // Billing info
        billingReason: data.billing_reason,
        failureMessage: data.failure_message,
        promoCode: data.promo_code,

        // Timestamps
        createdAt: data.created_at ? new Date(data.created_at) : undefined,
        paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
        lastPaymentAttempt: data.last_payment_attempt
          ? new Date(data.last_payment_attempt)
          : undefined,

        // Increment retry count
        $inc: { retryCount: 1 },
        lastRetryAt: new Date(),

        // Metadata
        metadata: data.metadata,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    console.log("✅ Failed payment logged:", payment._id);

    // TODO: Send notification to user about failed payment
    // TODO: If retryable, you could schedule a retry

    if (data.retryable && payment.retryCount < 3) {
      console.log("🔄 Payment is retryable. Consider scheduling a retry.");
      // You could add logic here to trigger a retry mechanism
    }
  } catch (error) {
    console.error("❌ Error saving failed payment:", error);
    throw error;
  }
}

module.exports = router;
