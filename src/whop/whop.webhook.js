const express = require("express");
const router = express.Router();
const crypto = require("crypto");

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

        case "membership.renewed":
          console.log("🔄 Membership renewed!");
          await handleMembershipRenewed(event.data);
          break;

        case "membership.cancelled":
          console.log("❌ Membership cancelled");
          await handleMembershipCancelled(event.data);
          break;

        case "membership.expired":
          console.log("⏰ Membership expired");
          await handleMembershipExpired(event.data);
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

  console.log("👤 User ID (from metadata):", userId);
  console.log("🆔 Whop Membership ID:", whopMembershipId);
  console.log("👥 Whop User ID:", whopUserId);
  console.log("📦 Plan ID:", planId);
  console.log("🏷️ Product ID:", productId);

  if (!userId) {
    console.warn("⚠️ No userId in metadata - using Whop user ID instead");
    // You might need to look up your user by whopUserId or email
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

async function handleMembershipRenewed(data) {
  console.log("📋 Processing membership renewal...");

  const userId = data.metadata?.userId;
  const whopMembershipId = data.id;
  const expiresAt = data.expires_at;

  console.log("👤 User ID:", userId);
  console.log("🆔 Membership ID:", whopMembershipId);
  console.log("📅 New expiration:", new Date(expiresAt * 1000).toISOString());

  // TODO: Update subscription expiration date
  // await User.findByIdAndUpdate(userId, {
  //   subscriptionExpiresAt: new Date(expiresAt * 1000),
  //   subscriptionStatus: "active",
  // });

  console.log("✅ Membership renewal processed");
}

async function handleMembershipCancelled(data) {
  console.log("📋 Processing membership cancellation...");

  const userId = data.metadata?.userId;
  const whopMembershipId = data.id;
  const cancelAtPeriodEnd = data.cancel_at_period_end;
  const expiresAt = data.expires_at;

  console.log("👤 User ID:", userId);
  console.log("🆔 Membership ID:", whopMembershipId);
  console.log("🔄 Cancel at period end:", cancelAtPeriodEnd);

  if (cancelAtPeriodEnd) {
    console.log(
      "📅 Access continues until:",
      new Date(expiresAt * 1000).toISOString()
    );
    // TODO: Mark as "cancelling" - will expire at end of period
    // await User.findByIdAndUpdate(userId, {
    //   subscriptionStatus: "cancelling",
    //   subscriptionCancelAtPeriodEnd: true,
    // });
  } else {
    console.log("⚠️ Immediate cancellation");
    // TODO: Mark as "cancelled" - access revoked immediately
    // await User.findByIdAndUpdate(userId, {
    //   subscriptionStatus: "cancelled",
    //   subscriptionCancelAtPeriodEnd: false,
    // });
  }

  console.log("✅ Membership cancellation processed");
}

async function handleMembershipExpired(data) {
  console.log("📋 Processing membership expiration...");

  const userId = data.metadata?.userId;
  const whopMembershipId = data.id;

  console.log("👤 User ID:", userId);
  console.log("🆔 Membership ID:", whopMembershipId);

  // TODO: Mark subscription as expired
  // await User.findByIdAndUpdate(userId, {
  //   subscriptionStatus: "expired",
  // });

  console.log("✅ Membership expiration processed");
}

async function handlePaymentSucceeded(data) {
  console.log("📋 Processing successful payment...");

  const userId = data.metadata?.userId;
  const challengeId = data.metadata?.challengeId;
  const paymentId = data.id;
  const amount = data.total; // Convert from cents
  const currency = data.currency;

  console.log("👤 User ID:", userId);
  console.log("💰 Payment ID:", paymentId);
  console.log("💵 Amount:", amount, currency.toUpperCase());

  // TODO: Log payment in your database
  // await Payment.create({
  //   userId: userId,
  //   whopPaymentId: paymentId,
  //   amount: amount,
  //   currency: currency,
  //   status: "succeeded",
  // });

  console.log("✅ Payment processed");
}

async function handlePaymentFailed(data) {
  console.log("📋 Processing failed payment...");

  const userId = data.metadata?.userId;
  const paymentId = data.id;
  const failureReason = data.failure_message;

  console.log("👤 User ID:", userId);
  console.log("💰 Payment ID:", paymentId);
  console.log("❌ Failure reason:", failureReason);

  // TODO: Handle failed payment (send notification, retry, etc.)
  // You might want to notify the user or attempt to retry

  console.log("✅ Failed payment logged");
}

module.exports = router;
