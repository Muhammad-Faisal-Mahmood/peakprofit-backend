const accountLiquidatorWrapper = async (
  accountId,
  violationRule,
  finalEquity,
  priceData // { symbol, price }
) => {
  const { handleAccountLiquidation } = require("../trade/tradeMonitor.service");

  try {
    await handleAccountLiquidation(
      accountId,
      violationRule,
      finalEquity,
      priceData
    );
  } catch (error) {
    console.log("error in accountLiquidatorWrapper: ", error.message);
  }
};

module.exports = accountLiquidatorWrapper;
