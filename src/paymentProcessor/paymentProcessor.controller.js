const Challenge = require("../challenge/challenge.model");
const {
  sendErrorResponse,
  sendSuccessResponse,
} = require("../shared/response.service");
const generateInvoiceNumber = require("../utils/generateInvoiceNumber");
const Payment = require("../payment/payment.model");
const express = require("express");
const router = express.Router();
const jwt = require("../middleware/jwt");
const PaymentSession = require("./paymentSession/paymentSession.model");

router.post("/checkout/create", jwt, async (req, res) => {
  try {
    const { challengeId } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return sendErrorResponse(res, "Not authenticated");
    }

    const challenge = await Challenge.findById(challengeId);
    if (!challenge || challenge.cost <= 0) {
      return sendErrorResponse(res, "Invalid challenge");
    }

    /* -------------------- EXPIRE OLD SESSIONS -------------------- */
    const oldSessions = await PaymentSession.find({
      userId,
      status: "pending",
    });

    const oldSessionIds = oldSessions.map((s) => s._id);

    await PaymentSession.updateMany(
      { _id: { $in: oldSessionIds } },
      { status: "expired" }
    );

    await Payment.updateMany(
      { sessionId: { $in: oldSessionIds }, status: "pending" },
      { status: "failed" }
    );

    /* -------------------- CREATE SESSION -------------------- */
    const session = await PaymentSession.create({
      userId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      status: "pending",
    });

    /* -------------------- CREATE PAYMENT -------------------- */
    const payment = await Payment.create({
      userId,
      sessionId: session._id,
      challengeId,
      invoiceNumber: generateInvoiceNumber(),
      authAmount: challenge.cost,
      currency: "USD",
      status: "pending",
      orderDescription: challenge.name,
      metadata: { provider: "authorize_net" },
    });

    /* -------------------- LINK SESSION → PAYMENT -------------------- */
    session.paymentId = payment._id;
    await session.save();

    return sendSuccessResponse(res, "Checkout session created", {
      sessionId: session._id,
      sessionCreatedAt: session.createdAt,
      sessionExpiresAt: session.expiresAt,
      sessionStatus: session.status,
      paymentStatus: payment.status,
      challenge: {
        id: challenge._id,
        name: challenge.name,
        cost: challenge.cost,
      },
    });
  } catch (err) {
    console.error(err);
    return sendErrorResponse(res, "Couldn't create checkout session");
  }
});

router.get("/checkout/session", jwt, async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return sendErrorResponse(res, "Not authenticated");
    }

    const session = await PaymentSession.findOne({
      userId,
      status: "pending",
      expiresAt: { $gt: new Date() },
    }).populate({
      path: "paymentId",
      populate: {
        path: "challengeId",
        select: "name cost",
      },
    });

    if (!session) {
      return sendSuccessResponse(res, "No pending session", null);
    }

    return sendSuccessResponse(res, "Pending session found", {
      sessionId: session._id,
      expiresAt: session.expiresAt,
      payment: {
        id: session.paymentId._id,
        amount: session.paymentId.authAmount,
        invoiceNumber: session.paymentId.invoiceNumber,
      },
      challenge: session.paymentId.challengeId,
    });
  } catch (err) {
    return sendErrorResponse(res, "Failed to fetch pending session");
  }
});

router.post("/checkout/session/expire", jwt, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return sendErrorResponse(res, "Not authenticated");
    }

    const session = await PaymentSession.findOne({
      _id: sessionId,
      userId,
      status: "pending",
    }).populate({
      path: "paymentId",
      select: "authAmount invoiceNumber status",
    });

    if (!session) {
      return sendErrorResponse(res, "Invalid or expired session");
    }

    /* -------------------- EXPIRE SESSION -------------------- */
    session.status = "expired";
    await session.save();

    /* -------------------- FAIL PAYMENT -------------------- */
    if (session.paymentId) {
      await Payment.updateOne(
        { _id: session.paymentId._id, status: "pending" },
        { status: "failed" }
      );
    }

    /* -------------------- RESPONSE DTO -------------------- */
    return sendSuccessResponse(res, "Session expired successfully", {
      sessionId: session._id,
      status: session.status,
      expiresAt: session.expiresAt,
      updatedAt: session.updatedAt,
      payment: session.paymentId
        ? {
            id: session.paymentId._id,
            status: "failed",
            amount: session.paymentId.authAmount,
            invoiceNumber: session.paymentId.invoiceNumber,
          }
        : null,
    });
  } catch (err) {
    console.error(err);
    return sendErrorResponse(res, "Failed to expire session");
  }
});

module.exports = router;
