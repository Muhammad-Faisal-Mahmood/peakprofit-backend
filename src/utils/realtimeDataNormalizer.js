/**
 * RealtimeDataNormalizer.js
 * Normalizes and aggregates real-time price data to prevent wild spikes
 */

class RealtimeDataNormalizer {
  constructor(options = {}) {
    // Moving window for price validation
    this.priceHistory = new Map(); // symbol -> array of recent prices
    this.historySize = options.historySize || 20; // Keep last 20 ticks

    // Aggregation windows
    this.aggregationWindow = options.aggregationWindow || 700; // Match throttle
    this.pendingTicks = new Map(); // symbol -> array of ticks in current window
    this.lastAggregation = new Map(); // symbol -> timestamp of last aggregation

    // Outlier detection parameters
    this.maxDeviationPercent = options.maxDeviationPercent || 0.03; // 3% max deviation
    this.minTicksForValidation = options.minTicksForValidation || 5;

    // VWAP calculation
    this.enableVWAP = options.enableVWAP !== false;
  }

  /**
   * Process incoming tick and decide whether to emit it
   */
  processTick(tick) {
    const symbol = tick.symbol;
    const now = Date.now();

    // Initialize structures for new symbol
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
      this.pendingTicks.set(symbol, []);
      this.lastAggregation.set(symbol, now);
    }

    // Validate and potentially filter the tick
    const validatedTick = this.validateTick(tick);
    if (!validatedTick) {
      console.log(
        `[Normalizer] Filtered outlier tick for ${symbol}: ${tick.price}`
      );
      return null; // Skip this tick
    }

    // Add to pending ticks for aggregation
    this.pendingTicks.get(symbol).push(validatedTick);

    // Check if we should aggregate
    const lastAgg = this.lastAggregation.get(symbol);
    if (now - lastAgg >= this.aggregationWindow) {
      return this.aggregateAndEmit(symbol, now);
    }

    return null; // Wait for more ticks
  }

  /**
   * Validate tick against recent price history
   */
  validateTick(tick) {
    const symbol = tick.symbol;
    const history = this.priceHistory.get(symbol);

    // Not enough history yet - accept tick
    if (history.length < this.minTicksForValidation) {
      this.addToHistory(symbol, tick.price);
      return tick;
    }

    // Calculate moving average and standard deviation
    const prices = history.slice(-this.historySize);
    const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance =
      prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);

    // Check for extreme deviation
    const deviation = Math.abs(tick.price - avg) / avg;
    const zScore = Math.abs(tick.price - avg) / (stdDev || 1);

    // Filter if:
    // 1. Price deviates more than maxDeviationPercent (e.g., 3%)
    // 2. Z-score is greater than 3 (statistical outlier)
    if (deviation > this.maxDeviationPercent && zScore > 3) {
      // This is likely a flash crash or erroneous tick
      // Return a capped version instead of the raw tick
      const cappedPrice =
        tick.price > avg
          ? avg * (1 + this.maxDeviationPercent)
          : avg * (1 - this.maxDeviationPercent);

      return {
        ...tick,
        price: cappedPrice,
        capped: true,
        originalPrice: tick.price,
      };
    }

    // Valid tick - add to history
    this.addToHistory(symbol, tick.price);
    return tick;
  }

  /**
   * Add price to history buffer
   */
  addToHistory(symbol, price) {
    const history = this.priceHistory.get(symbol);
    history.push(price);

    // Keep only last N prices
    if (history.length > this.historySize) {
      history.shift();
    }
  }

  /**
   * Aggregate pending ticks into a single normalized tick
   */
  aggregateAndEmit(symbol, now) {
    const ticks = this.pendingTicks.get(symbol);

    if (ticks.length === 0) {
      return null;
    }

    // Calculate aggregated values
    const aggregated = this.calculateAggregatedTick(symbol, ticks);

    // Clear pending ticks
    this.pendingTicks.set(symbol, []);
    this.lastAggregation.set(symbol, now);

    return aggregated;
  }

  /**
   * Calculate aggregated tick from multiple ticks
   */
  calculateAggregatedTick(symbol, ticks) {
    if (ticks.length === 1) {
      return ticks[0];
    }

    // Extract prices and volumes
    const prices = ticks.map((t) => t.price);
    const volumes = ticks.map((t) => t.volume || 0);
    const timestamps = ticks.map((t) => t.timestamp || Date.now());

    // Calculate OHLC
    const open = ticks[0].price;
    const close = ticks[ticks.length - 1].price;
    const high = Math.max(...prices);
    const low = Math.min(...prices);

    // Calculate VWAP if volumes available
    let vwap = close;
    const totalVolume = volumes.reduce((sum, v) => sum + v, 0);

    if (this.enableVWAP && totalVolume > 0) {
      const volumeWeightedSum = ticks.reduce((sum, tick, i) => {
        return sum + tick.price * (volumes[i] || 0);
      }, 0);
      vwap = volumeWeightedSum / totalVolume;
    }

    // Use VWAP as price if available, otherwise use close
    const aggregatedPrice = this.enableVWAP && totalVolume > 0 ? vwap : close;

    return {
      symbol,
      price: aggregatedPrice,
      open,
      high,
      low,
      close,
      vwap,
      volume: totalVolume,
      timestamp: timestamps[timestamps.length - 1],
      tickCount: ticks.length,
      aggregated: true,
    };
  }

  /**
   * Force emit current pending ticks (useful on unsubscribe)
   */
  flush(symbol) {
    const ticks = this.pendingTicks.get(symbol);
    if (!ticks || ticks.length === 0) {
      return null;
    }

    const aggregated = this.calculateAggregatedTick(symbol, ticks);
    this.pendingTicks.set(symbol, []);
    return aggregated;
  }

  /**
   * Clear history for a symbol (when unsubscribed)
   */
  clearSymbol(symbol) {
    this.priceHistory.delete(symbol);
    this.pendingTicks.delete(symbol);
    this.lastAggregation.delete(symbol);
  }

  /**
   * Get statistics for monitoring
   */
  getStats(symbol) {
    const history = this.priceHistory.get(symbol) || [];
    const pending = this.pendingTicks.get(symbol) || [];

    if (history.length === 0) {
      return null;
    }

    const avg = history.reduce((sum, p) => sum + p, 0) / history.length;
    const variance =
      history.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) /
      history.length;
    const stdDev = Math.sqrt(variance);

    return {
      symbol,
      historySize: history.length,
      pendingTicks: pending.length,
      avgPrice: avg,
      stdDev,
      coefficientOfVariation: (stdDev / avg) * 100, // Volatility measure
    };
  }
}

module.exports = RealtimeDataNormalizer;
