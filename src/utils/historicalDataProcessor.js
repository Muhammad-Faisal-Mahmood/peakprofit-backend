/**
 * HistoricalDataProcessor.js
 * Intelligently processes historical OHLCV data for better visualization
 * WITHOUT destroying actual price information
 */

class HistoricalDataProcessor {
  constructor(options = {}) {
    this.preserveOriginal = options.preserveOriginal !== false;
    
    // Wick compression (not removal)
    this.wickCompressionEnabled = options.wickCompressionEnabled !== false;
    this.wickCompressionFactor = options.wickCompressionFactor || 0.6; // Compress to 60%
    
    // Outlier detection
    this.outlierDetectionEnabled = options.outlierDetectionEnabled !== false;
    this.outlierZScoreThreshold = options.outlierZScoreThreshold || 4; // More lenient than 3
    
    // Flash crash detection
    this.flashCrashDetectionEnabled = options.flashCrashDetectionEnabled !== false;
    this.flashCrashThreshold = options.flashCrashThreshold || 0.05; // 5% instant move
    
    // Timeframe-aware processing
    this.adaptToTimeframe = options.adaptToTimeframe !== false;
  }

  /**
   * Main processing function
   */
  process(data, timeframe = 'minute') {
    if (!data.results || !Array.isArray(data.results)) {
      return data;
    }

    let bars = [...data.results];
    
    // Determine processing aggressiveness based on timeframe
    const params = this.getTimespanParams(timeframe);

    
    // Step 1: Detect and flag anomalies (non-destructive)
    // bars = this.detectAnomalies(bars, params);
    
    // Step 2: Apply intelligent wick compression
    if (this.wickCompressionEnabled) {
      bars = this.compressWicks(bars, params);
    }
    
    // Step 3: Handle flash crashes
    if (this.flashCrashDetectionEnabled) {
      bars = this.handleFlashCrashes(bars, params);
    }

    return {
      ...data,
      results: bars,
      processed: true,
      processingParams: params
    };
  }

  /**
   * Get processing parameters based on timeframe
   */
 getTimespanParams(timespan) {

  switch (timespan) {
    case 'minute':
      return {
        timeframe: '1min',
        wickCompressionFactor: 0.2,
        outlierThreshold: 8,
        maxWickToBodyRatio: 8,
        flashCrashThreshold: 0.08
      };
    case 'hour':
      return {
        timeframe: '1hour',
        wickCompressionFactor: 0.8,
        outlierThreshold: 3.5,
        maxWickToBodyRatio: 5,
        flashCrashThreshold: 0.05
      };
    case 'day':
      return {
        timeframe: 'daily',
        wickCompressionFactor: 1.0,
        outlierThreshold: 3,
        maxWickToBodyRatio: Infinity,
        flashCrashThreshold: 0.04
      };
    default:
      console.warn("Unsupported timespan. Returning 1min by default.");
      return {
        timeframe: '1min',
        wickCompressionFactor: 0.5,
        outlierThreshold: 4.5,
        maxWickToBodyRatio: 8,
        flashCrashThreshold: 0.08
      };
  }
}



  /**
   * Parse timeframe string to minutes
   */
  parseTimeframe(timeframe) {
    const match = timeframe.match(/(\d+)(minute|hour|day)/);
    if (!match) return 1;
    
    const [, value, unit] = match;
    const num = parseInt(value);
    
    if (unit === 'minute') return num;
    if (unit === 'hour') return num * 60;
    if (unit === 'day') return num * 1440;
    return 1;
  }

  /**
   * Detect anomalies and flag them (non-destructive)
   */
  detectAnomalies(bars, params) {
    if (bars.length < 10) return bars;

    // Calculate statistics
    const typicalPrices = bars.map(b => (b.h + b.l + b.c) / 3);
    const mean = typicalPrices.reduce((a, b) => a + b, 0) / typicalPrices.length;
    const variance = typicalPrices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / typicalPrices.length;
    const stdDev = Math.sqrt(variance);

    return bars.map((bar, i) => {
      const flags = [];
      
      // Check for extreme high
      const highZScore = Math.abs(bar.h - mean) / stdDev;
      if (highZScore > params.outlierThreshold) {
        flags.push('extreme_high');
      }
      
      // Check for extreme low
      const lowZScore = Math.abs(bar.l - mean) / stdDev;
      if (lowZScore > params.outlierThreshold) {
        flags.push('extreme_low');
      }
      
      // Check wick-to-body ratio
      const body = Math.abs(bar.o - bar.c);
      const upperWick = bar.h - Math.max(bar.o, bar.c);
      const lowerWick = Math.min(bar.o, bar.c) - bar.l;
      
      if (body > 0) {
        const upperRatio = upperWick / body;
        const lowerRatio = lowerWick / body;
        
        if (upperRatio > params.maxWickToBodyRatio) {
          flags.push('extreme_upper_wick');
        }
        if (lowerRatio > params.maxWickToBodyRatio) {
          flags.push('extreme_lower_wick');
        }
      }
      
      // Check for flash crash (if not first bar)
      if (i > 0) {
        const prevClose = bars[i - 1].c;
        const change = Math.abs(bar.l - prevClose) / prevClose;
        const recovery = Math.abs(bar.c - bar.l) / Math.abs(bar.l - prevClose);
        
        // Flash crash: big drop then recovery in same candle
        if (change > params.flashCrashThreshold && recovery > 0.8) {
          flags.push('flash_crash');
        }
      }

      return {
        ...bar,
        anomalyFlags: flags,
        hasAnomalies: flags.length > 0
      };
    });
  }

  /**
   * Compress wicks intelligently (not remove)
   */
  compressWicks(bars, params) {
    return bars.map(bar => {
      // Preserve original data
      const original = { h: bar.h, l: bar.l, o: bar.o, c: bar.c };
      
      // Skip bars without anomalies or with zero body
      const body = Math.abs(bar.o - bar.c);
      if (!bar.hasAnomalies || body === 0) {
        return { ...bar, original };
      }

      // Calculate compression
      const bodyTop = Math.max(bar.o, bar.c);
      const bodyBottom = Math.min(bar.o, bar.c);
      const bodyMid = (bodyTop + bodyBottom) / 2;
      
      const upperWick = bar.h - bodyTop;
      const lowerWick = bodyBottom - bar.l;

    
      
      // Apply compression factor
      const compressedUpperWick = upperWick * params.wickCompressionFactor;
      const compressedLowerWick = lowerWick * params.wickCompressionFactor;

      //   console.log("upperwick: ", upperWick)
      // console.log("lowerWick: ", lowerWick)
      
      // console.log("compressedUpperWick: ", compressedUpperWick)
      // console.log("compressedLowerWick: ", compressedLowerWick)
      
      // New high/low
      let newHigh = bodyTop + compressedUpperWick;
      let newLow = bodyBottom - compressedLowerWick;
      
      // Additional capping for extreme wicks
      if (bar.anomalyFlags.includes('extreme_upper_wick')) {
        const maxAllowedUpperWick = body * params.maxWickToBodyRatio;
        newHigh = Math.min(newHigh, bodyTop + maxAllowedUpperWick);
      }
      
      if (bar.anomalyFlags.includes('extreme_lower_wick')) {
        const maxAllowedLowerWick = body * params.maxWickToBodyRatio;
        newLow = Math.max(newLow, bodyBottom - maxAllowedLowerWick);
      }
      
      // Ensure OHLC validity
      newHigh = Math.max(newHigh, bar.o, bar.c);
      newLow = Math.min(newLow, bar.o, bar.c);

      return {
        ...bar,
        h: newHigh,
        l: newLow,
        original,
        compressed: true,
        compressionFactor: params.wickCompressionFactor
      };
    });
  }

  /**
   * Handle flash crashes by capping recovery
   */
  handleFlashCrashes(bars, params) {
    return bars.map((bar, i) => {
      if (!bar.anomalyFlags || !bar.anomalyFlags.includes('flash_crash')) {
        return bar;
      }

      // For flash crashes, cap the low to be less extreme
      const prevClose = i > 0 ? bars[i - 1].c : bar.o;
      const maxDrop = prevClose * params.flashCrashThreshold;
      const cappedLow = Math.max(bar.l, prevClose - maxDrop);

      return {
        ...bar,
        l: cappedLow,
        flashCrashCapped: true,
        originalLow: bar.original?.l || bar.l
      };
    });
  }

  /**
   * Get processing statistics
   */
  getStats(bars) {
    const stats = {
      total: bars.length,
      compressed: 0,
      flagged: 0,
      flashCrashes: 0,
      extremeWicks: 0
    };

    bars.forEach(bar => {
      if (bar.compressed) stats.compressed++;
      if (bar.hasAnomalies) stats.flagged++;
      if (bar.flashCrashCapped) stats.flashCrashes++;
      if (bar.anomalyFlags?.some(f => f.includes('extreme_wick'))) {
        stats.extremeWicks++;
      }
    });

    stats.compressionRate = ((stats.compressed / stats.total) * 100).toFixed(1) + '%';
    stats.anomalyRate = ((stats.flagged / stats.total) * 100).toFixed(1) + '%';

    return stats;
  }
}

// Usage examples:
module.exports = HistoricalDataProcessor;

// Example 1: Conservative (preserve most data)
const conservative = new HistoricalDataProcessor({
  wickCompressionEnabled: true,
  wickCompressionFactor: 0.8,        // Only compress to 80%
  outlierZScoreThreshold: 5,         // Very lenient
  flashCrashThreshold: 0.10          // Only 10%+ moves
});

// Example 2: Balanced (recommended)
const balanced = new HistoricalDataProcessor({
  wickCompressionEnabled: true,
  wickCompressionFactor: 0.6,        // Compress to 60%
  outlierZScoreThreshold: 4,         // Balanced
  flashCrashThreshold: 0.05,         // 5%+ moves
  adaptToTimeframe: true             // Auto-adjust
});

// Example 3: Aggressive (clean charts)
const aggressive = new HistoricalDataProcessor({
  wickCompressionEnabled: true,
  wickCompressionFactor: 0.4,        // Heavy compression
  outlierZScoreThreshold: 3,         // Strict
  flashCrashThreshold: 0.03,         // 3%+ moves
  adaptToTimeframe: true
});

/*
Usage in your code:

const processor = new HistoricalDataProcessor({
  wickCompressionFactor: 0.6,
  adaptToTimeframe: true
});

// When fetching 1-min data
const processed = processor.process(rawData, '1min');

// When fetching 1-hour data  
const processed = processor.process(rawData, '1hour');

// Original data is always preserved in bar.original
processed.results.forEach(bar => {
  console.log('Display:', bar.h, bar.l);
  console.log('Actual:', bar.original.h, bar.original.l);
});
*/