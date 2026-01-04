const Challenge = require("../challenge/challenge.model");
const {
  sendErrorResponse,
  sendSuccessResponse,
} = require("../shared/response.service");
const generateInvoiceNumber = require("../utils/generateInvoiceNumber");
const Payment = require("../payment/payment.model");
const ApiContracts = require("authorizenet").APIContracts;
const ApiControllers = require("authorizenet").APIControllers;
const SDKConstants = require("authorizenet").Constants;

const createAuthorizeNetCheckout = async (req, res) => {
  try {
    const { challengeId } = req.body;
    const user = req.user;

    if (!user || !user.userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const requestedChallenge = await Challenge.findById(challengeId);
    if (!requestedChallenge) {
      return sendErrorResponse(res, "No such challenge exists");
    }

    const amount = requestedChallenge.cost;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid challenge price" });
    }

    // ✅ Generate invoice number
    const invoiceNumber = generateInvoiceNumber();

    // ✅ Create Payment BEFORE redirect
    const payment = await Payment.create({
      userId: user.userId,
      challengeId,
      invoiceNumber,
      authAmount: amount,
      status: "pending",
      orderDescription: requestedChallenge.name,
      metadata: {
        provider: "authorize_net",
      },
    });

    // ✅ Create hosted payment page
    const hostedPaymentPageResponse = await createHostedPaymentPage(
      amount,
      invoiceNumber,
      requestedChallenge
    );

    if (!hostedPaymentPageResponse.success) {
      await Payment.updateOne({ _id: payment._id }, { status: "failed" });

      return res.status(500).json({
        message: "Failed to create checkout session",
        error: hostedPaymentPageResponse.error,
      });
    }

    return res.json({
      success: true,
      url: hostedPaymentPageResponse.url,
      token: hostedPaymentPageResponse.token,
      invoiceNumber,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return res.status(500).json({
      message: "Failed to create checkout session",
      error: error.message,
    });
  }
};

function createHostedPaymentPage(amount, invoiceNumber, requestedChallenge) {
  return new Promise((resolve) => {
    const merchantAuthenticationType =
      new ApiContracts.MerchantAuthenticationType();

    merchantAuthenticationType.setName(process.env.AUTHORIZE_NET_API_LOGIN_ID);
    merchantAuthenticationType.setTransactionKey(
      process.env.AUTHORIZE_NET_TRANSACTION_KEY
    );

    const transactionRequestType = new ApiContracts.TransactionRequestType();

    transactionRequestType.setTransactionType(
      ApiContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION
    );
    transactionRequestType.setAmount(amount);

    // ✅ Order info (ONLY supported metadata)
    const orderType = new ApiContracts.OrderType();
    orderType.setInvoiceNumber(invoiceNumber);
    orderType.setDescription(requestedChallenge.name || "Challenge Payment");
    transactionRequestType.setOrder(orderType);

    // Hosted payment settings (unchanged)
    const settingList = [];

    const setting1 = new ApiContracts.SettingType();
    setting1.setSettingName("hostedPaymentButtonOptions");
    setting1.setSettingValue('{"text":"Pay"}');
    settingList.push(setting1);

    const setting2 = new ApiContracts.SettingType();
    setting2.setSettingName("hostedPaymentPaymentOptions");
    setting2.setSettingValue(
      '{"cardCodeRequired":true,"showCreditCard":true,"showBankAccount":true}'
    );

    settingList.push(setting2);

    const successSetting = new ApiContracts.SettingType();
    successSetting.setSettingName("hostedPaymentReturnOptions");
    successSetting.setSettingValue(
      JSON.stringify({
        showReceipt: false,
        url: `${process.env.FRONT_APP_URL_DEV}`,
        urlText: "Continue",
        cancelUrl: `${process.env.FRONT_APP_URL_DEV}`,
        cancelUrlText: "Cancel",
      })
    );
    settingList.push(successSetting);

    // ✅ CANCEL redirect
    // const cancelSetting = new ApiContracts.SettingType();
    // cancelSetting.setSettingName("hostedPaymentCancelOptions");
    // cancelSetting.setSettingValue(
    //   JSON.stringify({
    //     url: `${process.env.FRONT_APP_URL_DEV}`,
    //     urlText: "Cancel Payment",
    //   })
    // );
    // settingList.push(cancelSetting);

    const alist = new ApiContracts.ArrayOfSetting();
    alist.setSetting(settingList);

    const getRequest = new ApiContracts.GetHostedPaymentPageRequest();

    getRequest.setMerchantAuthentication(merchantAuthenticationType);
    getRequest.setTransactionRequest(transactionRequestType);
    getRequest.setHostedPaymentSettings(alist);

    const ctrl = new ApiControllers.GetHostedPaymentPageController(
      getRequest.getJSON()
    );

    ctrl.setEnvironment(
      process.env.AUTHORIZE_NET_ENVIRONMENT === "production"
        ? SDKConstants.endpoint.production
        : SDKConstants.endpoint.sandbox
    );

    ctrl.execute(() => {
      const response = new ApiContracts.GetHostedPaymentPageResponse(
        ctrl.getResponse()
      );

      if (
        response.getMessages().getResultCode() ===
        ApiContracts.MessageTypeEnum.OK
      ) {
        const token = response.getToken();

        resolve({
          success: true,
          token,
        });
      } else {
        const err = response.getMessages().getMessage()[0];
        resolve({
          success: false,
          error: err.getText(),
          errorCode: err.getCode(),
        });
      }
    });
  });
}

module.exports = createAuthorizeNetCheckout;
