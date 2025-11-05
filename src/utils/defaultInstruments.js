// utils/defaultInstruments.js
module.exports = [
  {
    symbol: "EUR-USD",
    name: "Euro / US Dollar",
    type: "forex",
    channel: "C", // e.g. "C" for forex trades, adjust as needed
    market: "forex",
    polygonSymbol: "C:EURUSD",
  },
  {
    symbol: "GBP-USD",
    name: "British Pound / US Dollar",
    type: "forex",
    channel: "C",
    market: "forex",
    polygonSymbol: "C:GBPUSD",
  },
  {
    symbol: "USD-JPY",
    name: "US Dollar / Japanese Yen",
    type: "forex",
    channel: "C",
    market: "forex",
    polygonSymbol: "C:USDJPY",
  },
  {
    symbol: "BTC-USD",
    name: "Bitcoin / US Dollar",
    type: "crypto",
    channel: "XT",
    market: "crypto",
    polygonSymbol: "XT:BTCUSD",
  },
  {
    symbol: "ETH-USD",
    name: "Ethereum / US Dollar",
    type: "crypto",
    channel: "XT",
    market: "crypto",
    polygonSymbol: "XT:ETHUSD",
  },
  {
    symbol: "XRP-USD",
    name: "Ripple / US Dollar",
    type: "crypto",
    channel: "XT",
    market: "crypto",
    polygonSymbol: "XT:XRPUSD",
  },
];
