function filterOutliers(bars, threshold = 3) {
  if (bars.length < 2) return bars;

  // Calculate typical price for each bar
  const typicalPrices = bars.map((bar) => (bar.h + bar.l + bar.c) / 3);

  // Calculate mean and standard deviation
  const mean = typicalPrices.reduce((a, b) => a + b, 0) / typicalPrices.length;
  const variance =
    typicalPrices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) /
    typicalPrices.length;
  const stdDev = Math.sqrt(variance);

  // Filter bars with extreme highs/lows
  return bars.map((bar) => {
    const filteredBar = { ...bar };

    // Cap extreme highs
    if (bar.h > mean + threshold * stdDev) {
      filteredBar.h = Math.min(bar.h, bar.c * 1.1); // Cap at 10% above close
    }

    // Cap extreme lows
    if (bar.l < mean - threshold * stdDev) {
      filteredBar.l = Math.max(bar.l, bar.c * 0.9); // Cap at 10% below close
    }

    // Ensure OHLC logic remains valid
    filteredBar.h = Math.max(filteredBar.h, filteredBar.o, filteredBar.c);
    filteredBar.l = Math.min(filteredBar.l, filteredBar.o, filteredBar.c);

    return filteredBar;
  });
}

function limitWicks(bars, maxWickPercentage = 0.15) {
  return bars.map((bar) => {
    const body = Math.abs(bar.o - bar.c);
    const bodyMid = (bar.o + bar.c) / 2;
    const maxWick = body * maxWickPercentage;

    return {
      ...bar,
      h: Math.min(bar.h, bodyMid + body / 2 + maxWick),
      l: Math.max(bar.l, bodyMid - body / 2 - maxWick),
    };
  });
}

function smoothOHLC(bars, window = 3) {
  if (bars.length < window) return bars;

  return bars.map((bar, i) => {
    const start = Math.max(0, i - Math.floor(window / 2));
    const end = Math.min(bars.length, i + Math.ceil(window / 2));
    const slice = bars.slice(start, end);

    const avgHigh = slice.reduce((sum, b) => sum + b.h, 0) / slice.length;
    const avgLow = slice.reduce((sum, b) => sum + b.l, 0) / slice.length;

    return {
      ...bar,
      h: (bar.h + avgHigh) / 2,
      l: (bar.l + avgLow) / 2,
    };
  });
}

function normalizeAggregates(data, options = {}) {
  console.log("normalize aggregates called");
  if (!data.results || !Array.isArray(data.results)) {
    return data;
  }

  const {
    removeOutliers = true,
    limitWicks: shouldLimitWicks = true, // ✅ Renamed
    smooth: shouldSmooth = false, // ✅ Renamed
    outlierThreshold = 3,
    maxWickPercentage = 0.15,
    smoothWindow = 3,
  } = options;

  let results = data.results;

  // Apply filters in sequence
  if (removeOutliers) {
    results = filterOutliers(results, outlierThreshold);
  }

  if (shouldLimitWicks) {
    // ✅ Use renamed variable
    results = limitWicks(results, maxWickPercentage);
  }

  if (shouldSmooth) {
    // ✅ Use renamed variable
    results = smoothOHLC(results, smoothWindow);
  }

  return {
    ...data,
    results,
    normalized: true,
  };
}

module.exports = normalizeAggregates;
