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
    process.env.NODE_ENV === "production"
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
  try {
    const { dataDescriptor, dataValue, paymentId, billingAddress } =
      req.body.paymentData;

    const paymentObject = await Payment.findById(paymentId);

    if (!paymentObject) {
      return sendErrorResponse(res, "Payment not found");
    }

    const sessionObject = PaymentSession.findById(paymentObject.sessionId);

    if (!sessionObject && session?.expiresAt < new Date()) {
      return sendErrorResponse(res, "Invalid session");
    }
    // Validate required fields
    if (!dataDescriptor || !dataValue) {
      return sendErrorResponse(
        res,
        "Missing required fields: dataDescriptor, dataValue"
      );
    }

    // Create payment data from token
    const opaqueData = new ApiContracts.OpaqueDataType();
    opaqueData.setDataDescriptor(dataDescriptor);
    opaqueData.setDataValue(dataValue);

    const payment = new ApiContracts.PaymentType(); // Changed variable name from paymentType to payment
    payment.setOpaqueData(opaqueData);

    // Create order information
    const orderDetails = new ApiContracts.OrderType();
    orderDetails.setInvoiceNumber(paymentObject.invoiceNumber);
    orderDetails.setDescription("Payment transaction");

    // Create transaction request
    const transactionRequestType = new ApiContracts.TransactionRequestType();
    transactionRequestType.setTransactionType(
      ApiContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION
    );
    transactionRequestType.setPayment(payment); // Use 'payment' instead of 'paymentType'
    transactionRequestType.setAmount(paymentObject.authAmount);
    transactionRequestType.setOrder(orderDetails);
    // transactionRequestType.setRefId(paymentId || `ref-${Date.now()}`); // Use paymentId or generate one

    // REMOVED - customerEmail is not in your req.body destructuring - ISSUE #2
    // If you want to add customer email, add it to your frontend request body first

    // Add billing information if provided
    if (billingAddress) {
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

    // Create the API request
    const createRequest = new ApiContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(getMerchantAuth());
    createRequest.setTransactionRequest(transactionRequestType); // setRefId should be on transactionRequestType, not here

    // Execute the transaction
    const ctrl = new ApiControllers.CreateTransactionController(
      createRequest.getJSON()
    );
    ctrl.setEnvironment(config.environment);

    // Execute the request
    const response = await new Promise((resolve, reject) => {
      ctrl.execute(() => {
        const apiResponse = ctrl.getResponse();
        const response = new ApiContracts.CreateTransactionResponse(
          apiResponse
        );

        if (response !== null) {
          if (
            response.getMessages().getResultCode() ===
            ApiContracts.MessageTypeEnum.OK
          ) {
            const transactionResponse = response.getTransactionResponse();

            if (transactionResponse.getMessages() !== null) {
              resolve({
                success: true,
                transactionId: transactionResponse.getTransId(),
                authCode: transactionResponse.getAuthCode(),
                accountNumber: transactionResponse.getAccountNumber(),
                accountType: transactionResponse.getAccountType(),
                message: transactionResponse
                  .getMessages()
                  .getMessage()[0]
                  .getDescription(),
                responseCode: transactionResponse.getResponseCode(),
              });
            } else {
              if (transactionResponse.getErrors() !== null) {
                reject({
                  success: false,
                  errorCode: transactionResponse
                    .getErrors()
                    .getError()[0]
                    .getErrorCode(),
                  errorMessage: transactionResponse
                    .getErrors()
                    .getError()[0]
                    .getErrorText(),
                });
              }
            }
          } else {
            if (
              response.getTransactionResponse() !== null &&
              response.getTransactionResponse().getErrors() !== null
            ) {
              reject({
                success: false,
                errorCode: response
                  .getTransactionResponse()
                  .getErrors()
                  .getError()[0]
                  .getErrorCode(),
                errorMessage: response
                  .getTransactionResponse()
                  .getErrors()
                  .getError()[0]
                  .getErrorText(),
              });
            } else {
              reject({
                success: false,
                errorCode: response.getMessages().getMessage()[0].getCode(),
                errorMessage: response.getMessages().getMessage()[0].getText(),
              });
            }
          }
        } else {
          reject({
            success: false,
            error: "No response from payment gateway",
          });
        }
      });
    });

    return sendSuccessResponse(res, "payment processed successfully", response);
  } catch (error) {
    console.error("Payment processing error:", error);
    return sendErrorResponse(res, "Couldn't process payment");
  }
});

module.exports = router;
