const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env"),
});

const mongoose = require("mongoose");

// Import models - adjust paths based on your project structure
const User = require("./user/user.model");
const Account = require("./trade/account/account.model");
const KYC = require("./kyc/kyc.model");

const DB_URL = process.env.DB_URL;

/**
 * Seeder to create a test account ready for first payout
 * This account will have:
 * - Live account type
 * - Passed status
 * - 5+ days with 0.5%+ profit
 * - Balance > initial + $100
 * - No previous payouts (hasReceivedFirstPayout = false)
 * - Approved KYC
 */

async function createPayoutReadyAccount() {
  try {
    console.log("🌱 Starting seeder...");
    console.log(`📡 Connecting to MongoDB: ${DB_URL}`);

    await mongoose.connect(DB_URL);
    console.log("✅ Connected to MongoDB");

    // ===== 1. Find existing user =====
    console.log("\n👤 Finding user...");

    const userId = "693c46dc3f6918aeb92c9927";
    const testUser = await User.findById(userId);

    if (!testUser) {
      console.error(`❌ User not found with ID: ${userId}`);
      throw new Error("User not found");
    }

    console.log(`✅ Found user: ${testUser.name} (${testUser.email})`);

    // ===== 2. Check KYC status =====
    console.log("\n📋 Checking KYC status...");

    let kyc = await KYC.findOne({ _id: testUser.kycId });

    if (!kyc) {
      console.log("⚠️  No KYC found, creating approved KYC...");
      return;
    } else if (kyc.status !== "approved") {
      console.log(`⚠️  KYC status is ${kyc.status}, updating to approved...`);
      kyc.status = "approved";
      kyc.reviewedAt = new Date();
      await kyc.save();
      console.log("✅ Updated KYC to approved status");

      // Ensure user has KYC reference
      if (!testUser.kycId) {
        testUser.kycId = kyc._id;
        await testUser.save();
      }
    } else {
      console.log("✅ KYC already approved");

      // Ensure user has KYC reference
      if (!testUser.kycId) {
        testUser.kycId = kyc._id;
        await testUser.save();
        console.log("✅ Updated user with KYC reference");
      }
    }

    // ===== 3. Create payout-ready account =====
    console.log("\n💰 Creating payout-ready account...");

    const initialBalance = 100000; // $100,000
    const currentBalance = 112000; // $112,000 (12% profit)

    // Create 7 days of profitable trading (more than required 5)
    const dailyProfits = [];
    const baseDate = new Date();

    for (let i = 6; i >= 0; i--) {
      const tradingDate = new Date(baseDate);
      tradingDate.setDate(tradingDate.getDate() - i);

      const dayStartBalance = initialBalance + i * 1500;
      const dayEndBalance = dayStartBalance + (Math.random() * 1000 + 500); // $500-$1500 profit per day
      const profitAmount = dayEndBalance - dayStartBalance;
      const profitPercentage = (profitAmount / dayStartBalance) * 100;

      dailyProfits.push({
        date: tradingDate,
        startingBalance: dayStartBalance,
        endingBalance: dayEndBalance,
        profitAmount: profitAmount,
        profitPercentage: profitPercentage,
        meetsMinimum: profitPercentage >= 0.5, // All days will meet this
      });

      console.log(
        `  Day ${7 - i}: ${tradingDate.toISOString().split("T")[0]} - ` +
          `Profit: $${profitAmount.toFixed(2)} (${profitPercentage.toFixed(
            2
          )}%) ` +
          `${profitPercentage >= 0.5 ? "✅" : "❌"}`
      );
    }

    const testAccount = new Account({
      userId: testUser._id,
      accountType: "live",
      status: "passed",

      // Financials
      initialBalance: initialBalance,
      balance: currentBalance,
      equity: currentBalance,
      marginUsed: 0,
      freeMargin: currentBalance,
      leverage: 50,

      // Risk tracking
      dailyDrawdownLimit: 2500, // 2.5% of initial
      maxDrawdownLimit: 7000, // 7% of initial
      profitTarget: 10, // Already exceeded with 12% profit
      minTradingDays: 5,
      activelyTradedDays: 7,
      lastTradeTimestamp: new Date(),

      // Daily profits (7 qualifying days)
      dailyProfits: dailyProfits,

      // Current day equity
      currentDayEquity: currentBalance,

      // Payout info
      lastPayoutDate: null,
      totalPayoutAmount: 0,
      payoutHistory: [],
      hasReceivedFirstPayout: false, // KEY: Not received first payout yet

      // Trade arrays
      openPositions: [],
      closedPositions: [],
      pendingOrders: [],
      cancelledOrders: [],
      pendingMargin: 0,
    });

    await testAccount.save();
    console.log(`✅ Created payout-ready account: ${testAccount._id}`);

    // ===== 4. Verify payout eligibility =====
    console.log("\n🔍 Verifying payout eligibility...");

    const eligibility = testAccount.canRequestPayout();
    const availablePayout = testAccount.getAvailablePayoutAmount();

    console.log("\n📊 Account Summary:");
    console.log("═══════════════════════════════════════════");
    console.log(`Account ID: ${testAccount._id}`);
    console.log(`User ID: ${testUser._id}`);
    console.log(`User Name: ${testUser.name}`);
    console.log(`User Email: ${testUser.email}`);
    console.log(`Account Type: ${testAccount.accountType}`);
    console.log(`Status: ${testAccount.status}`);
    console.log(`Initial Balance: $${testAccount.initialBalance.toFixed(2)}`);
    console.log(`Current Balance: $${testAccount.balance.toFixed(2)}`);
    console.log(
      `Total Profit: $${(
        testAccount.balance - testAccount.initialBalance
      ).toFixed(2)}`
    );
    console.log(
      `Profit %: ${(
        ((testAccount.balance - testAccount.initialBalance) /
          testAccount.initialBalance) *
        100
      ).toFixed(2)}%`
    );
    console.log(
      `Qualified Days: ${dailyProfits.filter((d) => d.meetsMinimum).length}/5`
    );
    console.log(
      `Has Received First Payout: ${testAccount.hasReceivedFirstPayout}`
    );
    console.log(
      `\n💵 Available Payout Amount: $${availablePayout.toFixed(
        2
      )} (85% of profit)`
    );
    console.log("\n✅ Payout Eligibility Check:");
    console.log(`Eligible: ${eligibility.eligible ? "✅ YES" : "❌ NO"}`);

    if (eligibility.errors.length > 0) {
      console.log("❌ Errors:");
      eligibility.errors.forEach((error) => console.log(`  - ${error}`));
    } else {
      console.log("✅ All criteria met! Ready for first payout.");
    }

    console.log("\n📝 Profit Days Info:");
    console.log(`Message: ${eligibility.profitDaysInfo.message}`);
    console.log("═══════════════════════════════════════════");

    // ===== 5. Test API request format =====
    console.log("\n🧪 Sample API Request for Testing:");
    console.log("═══════════════════════════════════════════");
    console.log("POST /api/withdrawals/request");
    console.log("Headers: { Authorization: 'Bearer <your-token>' }");
    console.log("Body:");
    console.log(
      JSON.stringify(
        {
          accountId: testAccount._id.toString(),
          amount: Math.floor(availablePayout), // Requesting full available amount
          paymentMethod: {
            type: "BANK_ACCOUNT",
            accountNumber: "1234567890",
            bankName: "Test Bank",
            accountHolderName: testUser.name,
          },
          notes: "First payout test",
        },
        null,
        2
      )
    );
    console.log("═══════════════════════════════════════════");

    console.log("\n✅ Seeder completed successfully!");
    console.log("\n🎯 Next Steps:");
    console.log("1. Use the accountId above to request a payout via API");
    console.log("2. After payout, check that hasReceivedFirstPayout = true");
    console.log(
      "3. Verify drawdown limits are set to 0 in both MongoDB and Redis"
    );
    console.log("4. Test that account cannot drop below initial balance");
    console.log("\n📝 Quick Copy:");
    console.log(`Account ID: ${testAccount._id}`);
    console.log(`User ID: ${testUser._id}`);
    console.log(`Payout Amount: ${Math.floor(availablePayout)}`);
  } catch (error) {
    console.error("❌ Error running seeder:", error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 MongoDB connection closed");
  }
}

// Run the seeder
createPayoutReadyAccount()
  .then(() => {
    console.log("\n🎉 Seeder finished!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Seeder failed:", error);
    process.exit(1);
  });
