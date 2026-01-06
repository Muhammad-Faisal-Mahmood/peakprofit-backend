/**
 * RealtimeDataNormalizer.js
 * Smooths out noise while adapting to legitimate market moves
 */

class RealtimeDataNormalizer {
  constructor(options = {}) {
    // Exponential smoothing - ADAPTIVE based on volatility
    this.smoothedPrices = new Map();
    this.baseSmoothingFactor = options.smoothingFactor || 0.3;
    this.adaptiveSmoothingEnabled = options.adaptiveSmoothingEnabled !== false;
    
    // Price history for trend detection
    this.priceHistory = new Map();
    this.historySize = options.historySize || 50;
    
    // Spike vs Trend detection
    this.maxInstantChange = options.maxInstantChange || 0.005; // 0.5%
    this.trendConfirmationTicks = options.trendConfirmationTicks || 3;
    this.directionHistory = new Map(); // Track recent price directions
    
    // Volatility regime detection
    this.volatilityWindow = options.volatilityWindow || 20;
    this.highVolatilityThreshold = options.highVolatilityThreshold || 0.02; // 2% std dev
    this.currentRegime = new Map(); // 'normal' | 'volatile' | 'trending'
    
    // Rate limiting
    this.minUpdateInterval = options.minUpdateInterval || 100;
    this.lastEmitTime = new Map();
    
    // Initialization
    this.initialized = new Map();
    this.tickCounter = new Map();
  }

  /**
   * Main processing function with adaptive behavior
   */
  processTick(tick) {
    const symbol = tick.symbol;
    const now = Date.now();
    
    // Initialize
    if (!this.initialized.has(symbol)) {
      this.initializeSymbol(symbol, tick.price);
      return this.createTick(symbol, tick.price, tick, 'initialized');
    }
    
    // Rate limiting
    const lastEmit = this.lastEmitTime.get(symbol) || 0;
    if (now - lastEmit < this.minUpdateInterval) {
      return null;
    }
    
    // Increment tick counter
    const tickCount = (this.tickCounter.get(symbol) || 0) + 1;
    this.tickCounter.set(symbol, tickCount);
    
    // Detect market regime
    const regime = this.detectMarketRegime(symbol, tick.price);
    this.currentRegime.set(symbol, regime);
    
    // Process based on regime
    let processedPrice;
    let processingMode;
    
    switch (regime) {
      case 'trending':
        // Legitimate trend - use higher smoothing factor for faster response
        processedPrice = this.processTrendingPrice(symbol, tick.price);
        processingMode = 'trending';
        break;
        
      case 'volatile':
        // High volatility - medium smoothing
        processedPrice = this.processVolatilePrice(symbol, tick.price);
        processingMode = 'volatile';
        break;
        
      case 'normal':
      default:
        // Normal conditions - aggressive smoothing
        processedPrice = this.processNormalPrice(symbol, tick.price);
        processingMode = 'normal';
        break;
    }
    
    // Update history
    this.addToHistory(symbol, processedPrice);
    this.lastEmitTime.set(symbol, now);
    
    return this.createTick(symbol, processedPrice, tick, processingMode);
  }

  /**
   * Initialize symbol
   */
  initializeSymbol(symbol, price) {
    this.smoothedPrices.set(symbol, price);
    this.priceHistory.set(symbol, [price]);
    this.directionHistory.set(symbol, []);
    this.initialized.set(symbol, true);
    this.lastEmitTime.set(symbol, Date.now());
    this.tickCounter.set(symbol, 0);
    this.currentRegime.set(symbol, 'normal');
  }

  /**
   * Detect market regime: normal, volatile, or trending
   */
  detectMarketRegime(symbol, newPrice) {
    const history = this.priceHistory.get(symbol);
    const smoothed = this.smoothedPrices.get(symbol);
    
    if (history.length < 10) {
      return 'normal'; // Not enough data
    }
    
    // Calculate recent volatility
    const recentPrices = history.slice(-this.volatilityWindow);
    const volatility = this.calculateVolatility(recentPrices);
    
    // Check for consistent directional movement (trend)
    const isTrending = this.detectTrend(symbol, newPrice);
    
    if (isTrending) {
      console.log(`[Normalizer] ${symbol} - TRENDING detected (${volatility.toFixed(4)})`);
      return 'trending';
    }
    
    if (volatility > this.highVolatilityThreshold) {
      console.log(`[Normalizer] ${symbol} - HIGH VOLATILITY (${volatility.toFixed(4)})`);
      return 'volatile';
    }
    
    return 'normal';
  }

  /**
   * Calculate volatility (coefficient of variation)
   */
  calculateVolatility(prices) {
    const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    return stdDev / avg; // Coefficient of variation
  }

  /**
   * Detect if we're in a sustained trend
   */
  detectTrend(symbol, newPrice) {
    const smoothed = this.smoothedPrices.get(symbol);
    const directions = this.directionHistory.get(symbol);
    
    // Determine direction: 1 = up, -1 = down, 0 = sideways
    const change = (newPrice - smoothed) / smoothed;
    let direction = 0;
    
    if (Math.abs(change) > 0.002) { // 0.2% threshold
      direction = change > 0 ? 1 : -1;
    }
    
    // Add to direction history
    directions.push(direction);
    if (directions.length > this.trendConfirmationTicks * 2) {
      directions.shift();
    }
    
    // Check if we have consistent direction
    if (directions.length >= this.trendConfirmationTicks) {
      const recentDirections = directions.slice(-this.trendConfirmationTicks);
      const sum = recentDirections.reduce((s, d) => s + d, 0);
      
      // If all same direction (up or down), it's a trend
      if (Math.abs(sum) === this.trendConfirmationTicks) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Process price during TRENDING regime (news events, sustained moves)
   */
  processTrendingPrice(symbol, rawPrice) {
    const smoothed = this.smoothedPrices.get(symbol);
    
    // Use HIGHER smoothing factor for faster response to trends
    // But still cap extreme instant changes
    const change = Math.abs(rawPrice - smoothed) / smoothed;
    
    // Allow larger moves during trends (2% instead of 0.5%)
    const trendMaxChange = 0.02;
    let filteredPrice = rawPrice;
    
    if (change > trendMaxChange) {
      const direction = rawPrice > smoothed ? 1 : -1;
      filteredPrice = smoothed * (1 + direction * trendMaxChange);
      console.log(
        `[Normalizer] ${symbol} TREND capped: ${rawPrice.toFixed(2)} → ${filteredPrice.toFixed(2)}`
      );
    }
    
    // Use higher alpha (0.6-0.7) for faster trend following
    const trendSmoothingFactor = 0.6;
    const newSmoothed = 
      trendSmoothingFactor * filteredPrice + 
      (1 - trendSmoothingFactor) * smoothed;
    
    this.smoothedPrices.set(symbol, newSmoothed);
    return newSmoothed;
  }

  /**
   * Process price during VOLATILE regime
   */
  processVolatilePrice(symbol, rawPrice) {
    const smoothed = this.smoothedPrices.get(symbol);
    
    // Medium smoothing during volatility
    const change = Math.abs(rawPrice - smoothed) / smoothed;
    const volatileMaxChange = 0.01; // 1%
    
    let filteredPrice = rawPrice;
    if (change > volatileMaxChange) {
      const direction = rawPrice > smoothed ? 1 : -1;
      filteredPrice = smoothed * (1 + direction * volatileMaxChange);
    }
    
    // Medium alpha (0.4)
    const volatileSmoothingFactor = 0.4;
    const newSmoothed = 
      volatileSmoothingFactor * filteredPrice + 
      (1 - volatileSmoothingFactor) * smoothed;
    
    this.smoothedPrices.set(symbol, newSmoothed);
    return newSmoothed;
  }

  /**
   * Process price during NORMAL regime (filter noise aggressively)
   */
  processNormalPrice(symbol, rawPrice) {
    const smoothed = this.smoothedPrices.get(symbol);
    
    // Aggressive filtering during normal conditions
    const change = Math.abs(rawPrice - smoothed) / smoothed;
    const normalMaxChange = 0.005; // 0.5%
    
    let filteredPrice = rawPrice;
    if (change > normalMaxChange) {
      const direction = rawPrice > smoothed ? 1 : -1;
      filteredPrice = smoothed * (1 + direction * normalMaxChange);
      
      // Also check if it's an outlier
      const history = this.priceHistory.get(symbol);
      if (history.length >= 10) {
        const isOutlier = this.checkOutlier(rawPrice, history);
        if (isOutlier) {
          console.log(`[Normalizer] ${symbol} OUTLIER filtered: ${rawPrice.toFixed(2)}`);
          filteredPrice = smoothed; // Keep previous price
        }
      }
    }
    
    // Low alpha (0.2-0.3) for heavy smoothing
    const normalSmoothingFactor = this.baseSmoothingFactor;
    const newSmoothed = 
      normalSmoothingFactor * filteredPrice + 
      (1 - normalSmoothingFactor) * smoothed;
    
    this.smoothedPrices.set(symbol, newSmoothed);
    return newSmoothed;
  }

  /**
   * Check if price is statistical outlier
   */
  checkOutlier(price, history) {
    const recentPrices = history.slice(-20);
    const avg = recentPrices.reduce((sum, p) => sum + p, 0) / recentPrices.length;
    const variance = recentPrices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / recentPrices.length;
    const stdDev = Math.sqrt(variance);
    const zScore = Math.abs(price - avg) / (stdDev || 1);
    
    return zScore > 3; // 3 standard deviations
  }

  /**
   * Add price to history
   */
  addToHistory(symbol, price) {
    const history = this.priceHistory.get(symbol);
    history.push(price);
    if (history.length > this.historySize) {
      history.shift();
    }
  }

  /**
   * Create tick object
   */
  createTick(symbol, price, originalTick, mode) {
    return {
      symbol,
      price,
      volume: originalTick.volume || 0,
      timestamp: originalTick.timestamp || Date.now(),
      originalPrice: originalTick.price,
      processingMode: mode,
      regime: this.currentRegime.get(symbol),
      smoothed: true
    };
  }

  /**
   * Get current state
   */
  getState(symbol) {
    return {
      currentPrice: this.smoothedPrices.get(symbol),
      regime: this.currentRegime.get(symbol),
      tickCount: this.tickCounter.get(symbol),
      historySize: this.priceHistory.get(symbol)?.length || 0
    };
  }

  /**
   * Clear symbol
   */
  clearSymbol(symbol) {
    this.smoothedPrices.delete(symbol);
    this.priceHistory.delete(symbol);
    this.directionHistory.delete(symbol);
    this.initialized.delete(symbol);
    this.lastEmitTime.delete(symbol);
    this.tickCounter.delete(symbol);
    this.currentRegime.delete(symbol);
  }

  /**
   * Get statistics
   */
  getStats(symbol) {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length === 0) return null;

    const volatility = this.calculateVolatility(history);
    
    return {
      symbol,
      currentPrice: this.smoothedPrices.get(symbol),
      regime: this.currentRegime.get(symbol),
      volatility: (volatility * 100).toFixed(2) + '%',
      tickCount: this.tickCounter.get(symbol),
      historySize: history.length
    };
  }
}



module.exports = RealtimeDataNormalizer;