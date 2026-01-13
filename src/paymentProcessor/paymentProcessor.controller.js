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
const ApiContracts = require("authorizenet").APIContracts;
const ApiControllers = require("authorizenet").APIControllers;
const SDKConstants = require("authorizenet").Constants;

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
      createdAt: session.updatedAt,

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

const config = {
  apiLoginID: process.env.AUTHORIZE_NET_API_LOGIN_ID,
  transactionKey: process.env.AUTHORIZE_NET_TRANSACTION_KEY,
  environment:
    process.env.AUTHORIZE_NET_ENVIRONMENT === "production"
      ? SDKConstants.endpoint.production
      : SDKConstants.endpoint.sandbox,
};
function getMerchantAuth() {
  const merchantAuthenticationType =
    new ApiContracts.MerchantAuthenticationType();
  merchantAuthenticationType.setName(config.apiLoginID);
  merchantAuthenticationType.setTransactionKey(config.transactionKey);
  return merchantAuthenticationType;
}

router.post("/process-payment", async (req, res) => {
  const requestId = `pay_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  console.info(`[${requestId}] Process payment called`);

  try {
    const { dataDescriptor, dataValue, paymentId, billingAddress } =
      req.body.paymentData || {};

    console.info(`[${requestId}] Incoming request`, {
      paymentId,
      hasBillingAddress: !!billingAddress,
    });

    // ---- Load payment ----
    const paymentObject = await Payment.findById(paymentId);

    if (!paymentObject) {
      console.warn(`[${requestId}] Payment not found`, { paymentId });
      return sendErrorResponse(res, "Payment not found");
    }

    console.info(`[${requestId}] Payment loaded`, {
      paymentId: paymentObject._id,
      status: paymentObject.status,
      amount: paymentObject.authAmount,
      sessionId: paymentObject.sessionId,
    });

    // ---- Load session ----
    const sessionObject = await PaymentSession.findById(
      paymentObject.sessionId
    );

    if (!sessionObject || sessionObject.expiresAt < new Date()) {
      console.warn(`[${requestId}] Invalid or expired session`, {
        sessionId: paymentObject.sessionId,
        expired:
          sessionObject?.expiresAt && sessionObject.expiresAt < new Date(),
      });
      return sendErrorResponse(res, "Invalid session");
    }

    console.info(`[${requestId}] Session validated`, {
      sessionId: sessionObject._id,
      expiresAt: sessionObject.expiresAt,
    });

    // ---- Validate token ----
    if (!dataDescriptor || !dataValue) {
      console.warn(`[${requestId}] Missing Accept.js token`);
      return sendErrorResponse(
        res,
        "Missing required fields: dataDescriptor, dataValue"
      );
    }

    // ---- Build opaque payment ----
    console.info(`[${requestId}] Creating Authorize.Net transaction`);

    const opaqueData = new ApiContracts.OpaqueDataType();
    opaqueData.setDataDescriptor(dataDescriptor);
    opaqueData.setDataValue(dataValue);

    const payment = new ApiContracts.PaymentType();
    payment.setOpaqueData(opaqueData);

    const orderDetails = new ApiContracts.OrderType();
    orderDetails.setInvoiceNumber(paymentObject.invoiceNumber);
    orderDetails.setDescription("Payment transaction");

    const transactionRequestType = new ApiContracts.TransactionRequestType();
    transactionRequestType.setTransactionType(
      ApiContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION
    );
    transactionRequestType.setPayment(payment);
    transactionRequestType.setAmount(paymentObject.authAmount);
    transactionRequestType.setOrder(orderDetails);

    if (billingAddress) {
      console.info(`[${requestId}] Billing address provided`);
      const billTo = new ApiContracts.CustomerAddressType();
      billTo.setFirstName(billingAddress.firstName || "");
      billTo.setLastName(billingAddress.lastName || "");
      billTo.setAddress(billingAddress.street || "");
      billTo.setCity(billingAddress.city || "");
      billTo.setState(billingAddress.state || "");
      billTo.setZip(billingAddress.zipCode || "");
      billTo.setCountry(billingAddress.country || "US");
      billTo.setPhoneNumber(billingAddress.phoneNumber || "");
      transactionRequestType.setBillTo(billTo);
    }

    const createRequest = new ApiContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(getMerchantAuth());
    createRequest.setTransactionRequest(transactionRequestType);

    // ---- Execute transaction ----
    console.info(`[${requestId}] Sending request to Authorize.Net`, {
      environment: config.environment,
    });

    const ctrl = new ApiControllers.CreateTransactionController(
      createRequest.getJSON()
    );
    ctrl.setEnvironment(config.environment);

    const response = await new Promise((resolve, reject) => {
      ctrl.execute(async () => {
        const apiResponse = ctrl.getResponse();
        const response = new ApiContracts.CreateTransactionResponse(
          apiResponse
        );

        if (!response) {
          console.error(`[${requestId}] No gateway response`);
          return reject({ error: "No response from payment gateway" });
        }

        if (response.getTransactionResponse().getResponseCode() === "1") {
          const trx = response.getTransactionResponse();

          if (trx?.getMessages()) {
            console.info(`[${requestId}] Payment approved`, {
              transactionId: trx.getTransId(),
              responseCode: trx.getResponseCode(),
            });

            paymentObject.status = "approved";
            await paymentObject.save();
            sessionObject.status = "expired";
            await sessionObject.save();

            return resolve({
              success: true,
              transactionId: trx.getTransId(),
              authCode: trx.getAuthCode(),
              accountNumber: trx.getAccountNumber(),
              accountType: trx.getAccountType(),
              message: trx.getMessages().getMessage()[0].getDescription(),
              responseCode: trx.getResponseCode(),
            });
          }

          const err = trx.getErrors().getError()[0];
          console.warn(`[${requestId}] Gateway declined`, {
            errorCode: err.getErrorCode(),
            errorMessage: err.getErrorText(),
          });

          return reject({
            success: false,
            errorCode: err.getErrorCode(),
            errorMessage: err.getErrorText(),
          });
        }

        const msg = response.getMessages().getMessage()[0];
        console.warn(`[${requestId}] Gateway error`, {
          errorCode: msg.getCode(),
          errorMessage: msg.getText(),
        });

        reject({
          success: false,
          errorCode: msg.getCode(),
          errorMessage: msg.getText(),
        });
      });
    });

    console.info(`[${requestId}] Payment flow completed successfully`);
    return sendSuccessResponse(res, "payment processed successfully", response);
  } catch (error) {
    console.error(`[${requestId}] Payment processing error`, {
      message: error.errorMessage,
      code: error.errorCode,
    });
    return sendErrorResponse(
      res,
      error?.errorCode === "2"
        ? "Payment Declined"
        : error?.errorCode === "3"
        ? "Payment Error"
        : error?.errorCode === "4"
        ? "Payment Under Review"
        : "Payment failed"
    );
  }
});

module.exports = router;
