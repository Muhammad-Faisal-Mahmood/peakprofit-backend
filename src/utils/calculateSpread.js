function calculateSpread(market, units, price) {
  if (market === "crypto") {
    // 0.032% per side
    const rate = 0.00032;
    return units * price * rate;
  }

  if (market === "forex") {
    // $3 per lot (100,000 units)
    const LOT_SIZE = 100_000;
    const lots = units / LOT_SIZE;
    return lots * 3;
  }

  return 0;
}

module.exports = calculateSpread;
