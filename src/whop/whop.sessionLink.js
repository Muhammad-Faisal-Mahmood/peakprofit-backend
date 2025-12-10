/**
 * Fetches plans from Whop API and creates checkout session using matching price
 */
const Challenge = require("../challenge/challenge.model");
const {
  sendErrorResponse,
  sendSuccessResponse,
} = require("../shared/response.service");
createWhopCheckoutSession = async (req, res) => {
  try {
    const { challengeId } = req.body;
    const requestedChallenge = await Challenge.findById(challengeId);
    if (!requestedChallenge) {
      sendErrorResponse(res, "No such challenge exists");
    }
    const price = requestedChallenge.cost;
    console.log("📥 Request received - price:", price);

    const user = req.user;
    console.log("👤 User data:", user ? { userId: user.userId } : "No user");

    if (!user || !user.userId) {
      console.log("❌ User not authenticated");
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Step 1: Fetch the specific product with its plans
    const PRODUCT_ID = "prod_OIaMOZ82LkPjN";
    console.log(`🔍 Fetching product ${PRODUCT_ID} from Whop API...`);

    const productResponse = await fetch(
      `https://api.whop.com/api/v2/products/${PRODUCT_ID}?expand[]=plans`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.WHOP_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("📥 Product response status:", productResponse.status);
    console.log(
      "📥 Product response headers:",
      Object.fromEntries(productResponse.headers.entries())
    );

    // Get raw response text first
    const productText = await productResponse.text();
    console.log("📥 Raw product response:", productText.substring(0, 1000));
    console.log("📥 Response length:", productText.length);

    if (!productResponse.ok) {
      console.error(
        "❌ Failed to fetch product - Status:",
        productResponse.status
      );
      let errorData;
      try {
        errorData = JSON.parse(productText);
      } catch (e) {
        console.error("❌ Could not parse error response as JSON");
        errorData = { raw: productText.substring(0, 500) };
      }
      console.error("❌ Error data:", errorData);
      return res.status(500).json({
        message: "Failed to fetch product",
        error: errorData,
        status: productResponse.status,
      });
    }

    // Try to parse JSON
    let productData;
    try {
      productData = JSON.parse(productText);
      console.log("✅ Successfully parsed JSON");
      console.log("📥 Product data:", JSON.stringify(productData, null, 2));
    } catch (parseError) {
      console.error("❌ JSON Parse Error:", parseError.message);
      console.error("❌ Raw response was:", productText.substring(0, 500));
      return res.status(500).json({
        message: "Invalid response from Whop API",
        error: "Response was not valid JSON",
        responseText: productText.substring(0, 500),
        status: productResponse.status,
      });
    }

    // Step 2: Find the plan with matching price
    const plans = productData.plans || [];
    console.log(`🔍 Found ${plans.length} plans for product`);

    const matchingPlan = plans.find((plan) => {
      // Check both initial_price and renewal_price
      const initialPrice = plan.initial_price; // Whop stores prices in cents
      // const renewalPrice = plan.renewal_price ;
      const requestedPrice = price + ".0";

      console.log(
        `🔍 Checking plan ${plan.id}: initial=${initialPrice}, requested=${requestedPrice}`
      );

      return initialPrice === requestedPrice;
    });

    if (!matchingPlan) {
      console.log("❌ No matching plan found for price:", price);

      // Log available prices
      const availablePrices = plans.map((plan) => ({
        planId: plan.id,
        initialPrice: plan.initial_price,
      }));

      console.log("📊 Available plans:", availablePrices);

      return res.status(400).json({
        message: "No plan found for the selected price",
        requestedPrice: price,
        availablePlans: availablePrices,
      });
    }

    console.log("✅ Found matching plan:", matchingPlan.id);
    console.log("📋 Plan details:", {
      id: matchingPlan.id,
      initialPrice: matchingPlan.initial_price,
      directLink: matchingPlan.direct_link,
    });

    // Step 3: Create checkout session with the matching plan
    console.log(
      "🟢 Creating Whop checkout session with plan:",
      matchingPlan.id
    );

    const requestBody = {
      plan_id: matchingPlan.id,
      metadata: {
        userId: user.userId,
        price: price.toString(),
        challengeId: challengeId,
      },
    };

    console.log("📤 Request body:", JSON.stringify(requestBody, null, 2));

    const response = await fetch(
      "https://api.whop.com/api/v2/checkout_sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHOP_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    console.log("📥 Checkout response status:", response.status);
    console.log(
      "📥 Checkout response headers:",
      Object.fromEntries(response.headers.entries())
    );

    const responseText = await response.text();
    console.log("📥 Raw checkout response:", responseText.substring(0, 1000));

    let data;
    try {
      data = JSON.parse(responseText);
      console.log(
        "📥 Parsed checkout response:",
        JSON.stringify(data, null, 2)
      );
    } catch (parseError) {
      console.error("❌ JSON Parse Error:", parseError.message);
      return res.status(500).json({
        message: "Invalid response from Whop API",
        error: "Response was not valid JSON",
        responseText: responseText.substring(0, 500),
        status: response.status,
      });
    }

    if (!response.ok) {
      console.error("❌ Whop API Error:", JSON.stringify(data, null, 2));
      if (data.error?.status === 401 || response.status === 401) {
        console.error("❌ PERMISSION ERROR");
        return res.status(500).json({
          message: "API key doesn't have required permissions",
          error: data,
        });
      }
      return res.status(500).json({
        message: "Failed to create checkout session",
        error: data,
        status: response.status,
      });
    }

    console.log("✅ Success! Session ID:", data.id);
    console.log("✅ Checkout URL:", data.purchase_url || data.url);

    return res.json({
      url: data.purchase_url || data.url,
      sessionId: data.id,
      planId: matchingPlan.id,
      success: true,
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("❌ Stack:", error.stack);
    return res.status(500).json({
      message: "Failed to create checkout session",
      error: error.message,
    });
  }
};

module.exports = createWhopCheckoutSession;
