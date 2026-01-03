const Challenge = require("../challenge/challenge.model");
const {
  sendErrorResponse,
  sendSuccessResponse,
} = require("../shared/response.service");
const ApiContracts = require("authorizenet").APIContracts;
const ApiControllers = require("authorizenet").APIControllers;
const SDKConstants = require("authorizenet").Constants;

const createAuthorizeNetCheckout = async (req, res) => {
  try {
    const { challengeId } = req.body;

    console.log("📥 Request received for challengeId:", challengeId);

    const user = req.user;
    console.log("👤 User data:", user ? { userId: user.userId } : "No user");

    if (!user || !user.userId) {
      console.log("❌ User not authenticated");
      return res.status(401).json({ message: "User not authenticated" });
    }

    const requestedChallenge = await Challenge.findById(challengeId);
    if (!requestedChallenge) {
      console.log("❌ No such challenge exists");
      return sendErrorResponse(res, "No such challenge exists");
    }

    const price = requestedChallenge.cost;
    console.log("💰 Challenge cost:", price);

    if (!price || price <= 0) {
      console.log("❌ Invalid price:", price);
      return res.status(400).json({ message: "Invalid challenge price" });
    }

    const hostedPaymentPageResponse = await createHostedPaymentPage(
      price,
      user.userId,
      challengeId,
      requestedChallenge.name || "Challenge Payment"
    );

    if (hostedPaymentPageResponse.success) {
      console.log("✅ Success! Token:", hostedPaymentPageResponse.token);
      return res.json({
        success: true,
        token: hostedPaymentPageResponse.token,
        url: hostedPaymentPageResponse.url,
        metadata: hostedPaymentPageResponse.metadata,
      });
    } else {
      console.error(
        "❌ Failed to create payment page:",
        hostedPaymentPageResponse.error
      );
      return res.status(500).json({
        message: "Failed to create checkout session",
        error: hostedPaymentPageResponse.error,
        errorCode: hostedPaymentPageResponse.errorCode,
      });
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("❌ Stack:", error.stack);
    return res.status(500).json({
      message: "Failed to create checkout session",
      error: error.message,
    });
  }
};

function createHostedPaymentPage(amount, userId, challengeId, description) {
  return new Promise((resolve, reject) => {
    console.log("🔧 === Starting createHostedPaymentPage ===");

    if (
      !process.env.AUTHORIZE_NET_API_LOGIN_ID ||
      !process.env.AUTHORIZE_NET_TRANSACTION_KEY
    ) {
      console.error("❌ Missing API credentials in environment variables");
      resolve({
        success: false,
        error: "Missing API credentials",
        errorCode: "ENV_MISSING",
      });
      return;
    }

    console.log("🔧 Step 1: Creating merchant authentication...");
    const merchantAuthenticationType =
      new ApiContracts.MerchantAuthenticationType();
    merchantAuthenticationType.setName(process.env.AUTHORIZE_NET_API_LOGIN_ID);
    merchantAuthenticationType.setTransactionKey(
      process.env.AUTHORIZE_NET_TRANSACTION_KEY
    );

    console.log("🔧 Step 2: Creating transaction request...");
    const transactionRequestType = new ApiContracts.TransactionRequestType();
    transactionRequestType.setTransactionType(
      ApiContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION
    );
    transactionRequestType.setAmount(amount);

    console.log("🔧 Step 3: Adding order information...");
    const orderType = new ApiContracts.OrderType();
    const invoiceNumber = `CH_${challengeId}_${userId}`.substring(0, 20);
    const orderDescription = `Challenge:${challengeId} User:${userId}`;

    orderType.setInvoiceNumber(invoiceNumber);
    orderType.setDescription(orderDescription);
    transactionRequestType.setOrder(orderType);

    console.log("✅ Invoice Number:", invoiceNumber);
    console.log("✅ Order Description:", orderDescription);

    console.log("🔧 Step 4: Configuring minimal hosted payment settings...");

    const settingList = [];

    // SOLUTION: Use ONLY the settings that work
    // Don't include hostedPaymentReturnOptions - configure return URL in merchant account instead

    // Setting 1: Button options (this works fine)
    const setting1 = new ApiContracts.SettingType();
    setting1.setSettingName("hostedPaymentButtonOptions");
    setting1.setSettingValue('{"text":"Pay"}');
    settingList.push(setting1);

    // Setting 2: Payment options (this works fine)
    const setting2 = new ApiContracts.SettingType();
    setting2.setSettingName("hostedPaymentPaymentOptions");
    setting2.setSettingValue('{"cardCodeRequired":true,"showCreditCard":true}');
    settingList.push(setting2);

    // Setting 3: Customer options (optional)
    const setting3 = new ApiContracts.SettingType();
    setting3.setSettingName("hostedPaymentSecurityOptions");
    setting3.setSettingValue('{"captcha":false}');
    settingList.push(setting3);

    const alist = new ApiContracts.ArrayOfSetting();
    alist.setSetting(settingList);
    console.log("✅ Payment settings configured (minimal approach)");

    console.log("🔧 Step 5: Creating hosted payment page request...");
    const getRequest = new ApiContracts.GetHostedPaymentPageRequest();
    getRequest.setMerchantAuthentication(merchantAuthenticationType);
    getRequest.setTransactionRequest(transactionRequestType);
    getRequest.setHostedPaymentSettings(alist);

    console.log("🔧 Step 6: Executing API request...");
    const ctrl = new ApiControllers.GetHostedPaymentPageController(
      getRequest.getJSON()
    );

    const environment =
      process.env.AUTHORIZE_NET_ENVIRONMENT === "production"
        ? SDKConstants.endpoint.production
        : SDKConstants.endpoint.sandbox;

    ctrl.setEnvironment(environment);
    console.log(
      "✅ Environment set to:",
      process.env.AUTHORIZE_NET_ENVIRONMENT || "sandbox"
    );
    console.log("🚀 Executing API call...");

    ctrl.execute(() => {
      console.log("📥 Response received from Authorize.Net");

      const apiResponse = ctrl.getResponse();
      const response = new ApiContracts.GetHostedPaymentPageResponse(
        apiResponse
      );

      const resultCode = response.getMessages().getResultCode();
      console.log("📥 Result Code:", resultCode);

      if (resultCode === ApiContracts.MessageTypeEnum.OK) {
        const token = response.getToken();

        const isProduction =
          process.env.AUTHORIZE_NET_ENVIRONMENT === "production";
        const hostedPaymentUrl = isProduction
          ? "https://accept.authorize.net/payment/payment"
          : "https://test.authorize.net/payment/payment";

        const encodedToken = encodeURIComponent(token);
        const fullUrl = `${hostedPaymentUrl}?token=${encodedToken}`;

        console.log("✅ ========= SUCCESS =========");
        console.log("✅ Token:", token.substring(0, 50) + "...");
        console.log("✅ Payment URL:", fullUrl);
        console.log("✅ ============================");

        resolve({
          success: true,
          token: token,
          url: fullUrl,
          metadata: {
            userId,
            challengeId,
            amount,
          },
        });
      } else {
        console.error("❌ ========= FAILURE =========");
        const errorMessages = response.getMessages().getMessage();
        console.error("❌ Number of error messages:", errorMessages.length);

        errorMessages.forEach((msg, index) => {
          console.error(`❌ Error ${index + 1}:`);
          console.error("   - Code:", msg.getCode());
          console.error("   - Text:", msg.getText());
        });
        console.error("❌ ============================");

        resolve({
          success: false,
          error: errorMessages[0].getText(),
          errorCode: errorMessages[0].getCode(),
        });
      }
    });
  });
}

module.exports = createAuthorizeNetCheckout;
