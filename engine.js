'use strict';

// ── SELF-LEARNING PERFORMANCE TRACKER ────────────────────────────────────────
const performance = {
  conditions: {
    rsi_oversold_bull:    { wins: 0, losses: 0 },
    rsi_overbought_bear:  { wins: 0, losses: 0 },
    stoch_oversold_bull:  { wins: 0, losses: 0 },
    stoch_overbought_bear:{ wins: 0, losses: 0 },
    macd_bull:            { wins: 0, losses: 0 },
    macd_bear:            { wins: 0, losses: 0 },
    ema_bull_align:       { wins: 0, losses: 0 },
    ema_bear_align:       { wins: 0, losses: 0 },
    momentum_up:          { wins: 0, losses: 0 },
    momentum_down:        { wins: 0, losses: 0 },
    best_hour:            { wins: 0, losses: 0 },
    worst_hour:           { wins: 0, losses: 0 },
    near_support:         { wins: 0, losses: 0 },
    near_resistance:      { wins: 0, losses: 0 },
    high_volume:          { wins: 0, losses: 0 },
    low_volume:           { wins: 0, losses: 0 },
    htf_confirmed:        { wins: 0, losses: 0 },
    htf_conflicted:       { wins: 0, losses: 0 },
    fvg_bullish:          { wins: 0, losses: 0 },
    fvg_bearish:          { wins: 0, losses: 0 },
    volume_confirming:    { wins: 0, losses: 0 },
    volume_diverging:     { wins: 0, losses: 0 },
    htf_sr_support:       { wins: 0, losses: 0 },
    htf_sr_resistance:    { wins: 0, losses: 0 },
    // New MTF structure conditions
    bos_bull:             { wins: 0, losses: 0 },
    bos_bear:             { wins: 0, losses: 0 },
    liquidity_sweep_bull: { wins: 0, losses: 0 },
    liquidity_sweep_bear: { wins: 0, losses: 0 },
    fvg_reaction_bull:    { wins: 0, losses: 0 },
    fvg_reaction_bear:    { wins: 0, losses: 0 },
    mtf_aligned_bull:     { wins: 0, losses: 0 },
    mtf_aligned_bear:     { wins: 0, losses: 0 },
    premium_zone:         { wins: 0, losses: 0 },
    discount_zone:        { wins: 0, losses: 0 },
    bias_bull:            { wins: 0, losses: 0 },
    bias_bear:            { wins: 0, losses: 0 },
  },
  byType: {
    scalp_buy:  { wins: 0, losses: 0, totalPL: 0 },
    scalp_sell: { wins: 0, losses: 0, totalPL: 0 },
    day_buy:    { wins: 0, losses: 0, totalPL: 0 },
    day_sell:   { wins: 0, losses: 0, totalPL: 0 },
    swing_buy:  { wins: 0, losses: 0, totalPL: 0 },
    swing_sell: { wins: 0, losses: 0, totalPL: 0 },
  },
  recentTrades:         [],
  totalTrades:          0,
  consecutiveLosses:    0,
  maxConsecutiveLosses: 0,
};

function recordOutcome(trade) {
  const { type, tradeType, pl, isWin, conditions } = trade;
  const key = `${tradeType}_${type}`;
  if (performance.byType[key]) {
    if (isWin) performance.byType[key].wins++;
    else        performance.byType[key].losses++;
    performance.byType[key].totalPL += pl;
  }
  if (conditions) {
    conditions.forEach(c => {
      if (performance.conditions[c]) {
        if (isWin) performance.conditions[c].wins++;
        else        performance.conditions[c].losses++;
      }
    });
  }
  performance.recentTrades.push({ isWin, pl, type, tradeType });
  if (performance.recentTrades.length > 20) performance.recentTrades.shift();
  if (!isWin) {
    performance.consecutiveLosses++;
    performance.maxConsecutiveLosses = Math.max(performance.maxConsecutiveLosses, performance.consecutiveLosses);
  } else {
    performance.consecutiveLosses = 0;
  }
  performance.totalTrades++;
  // Persist to Postgres asynchronously (don't block trade flow)
  try {
    const { saveEngineState } = require('./db');
    saveEngineState(getPerformanceSnapshot()).catch(e => console.log('[Perf] Save error:', e.message));
  } catch(e) { /* db not ready yet */ }
}

// ── PERFORMANCE PERSISTENCE (Postgres via db.js) ──────────────────────────────
// getPerformanceSnapshot() — returns a plain object snapshot for saving
// mergePerformanceSnapshot() — merges a saved snapshot back into live performance
// Both called by main.js on startup and after each trade via recordOutcome.

function getPerformanceSnapshot() {
  return {
    conditions:           performance.conditions,
    byType:               performance.byType,
    totalTrades:          performance.totalTrades,
    consecutiveLosses:    performance.consecutiveLosses,
    maxConsecutiveLosses: performance.maxConsecutiveLosses,
    recentTrades:         performance.recentTrades,
  };
}

function mergePerformanceSnapshot(data) {
  if (!data) return;
  if (data.conditions) {
    Object.keys(data.conditions).forEach(k => {
      if (performance.conditions[k]) performance.conditions[k] = data.conditions[k];
    });
  }
  if (data.byType) {
    Object.keys(data.byType).forEach(k => {
      if (performance.byType[k]) performance.byType[k] = data.byType[k];
    });
  }
  if (data.totalTrades)          performance.totalTrades          = data.totalTrades;
  if (data.consecutiveLosses)    performance.consecutiveLosses    = data.consecutiveLosses;
  if (data.maxConsecutiveLosses) performance.maxConsecutiveLosses = data.maxConsecutiveLosses;
  if (data.recentTrades)         performance.recentTrades         = data.recentTrades;
}

// Seeds performance from pre-analyzed historical CSV data.
// Called once on startup BEFORE restorePerformanceFromSupabase so live learning takes priority.
function seedPerformanceFromHistory(seedData) {
  if (!seedData) return;
  console.log('[Perf] Seeding from historical data...');
  if (seedData.conditions) {
    Object.keys(seedData.conditions).forEach(k => {
      if (performance.conditions[k]) {
        performance.conditions[k].wins   += seedData.conditions[k].wins   || 0;
        performance.conditions[k].losses += seedData.conditions[k].losses || 0;
      }
    });
  }
  if (seedData.byType) {
    Object.keys(seedData.byType).forEach(k => {
      if (performance.byType[k]) {
        performance.byType[k].wins    += seedData.byType[k].wins    || 0;
        performance.byType[k].losses  += seedData.byType[k].losses  || 0;
        performance.byType[k].totalPL += seedData.byType[k].totalPL || 0;
      }
    });
  }
  if (seedData.totalTrades) performance.totalTrades += seedData.totalTrades;
  console.log(`[Perf] Seeded ${seedData.totalTrades || 0} historical trades`);
}

function resetLosses() {
  performance.consecutiveLosses = 0;
}

function getConditionWeight(condition, baseWeight) {
  const perf = performance.conditions[condition];
  if (!perf || (perf.wins + perf.losses) < 5) return baseWeight;
  const wr = perf.wins / (perf.wins + perf.losses);
  if (wr > 0.6) return baseWeight * 1.4;
  if (wr < 0.4) return baseWeight * 0.5;
  return baseWeight;
}

function getSizeMultiplier(confidence) {
  const losses = performance.consecutiveLosses;
  if (losses >= 15) return 0;
  if (losses >= 3) return 0.5;
  return Math.max(0.5, Math.min(1.0, confidence));
}

function getPerformanceSummary() {
  const recent = performance.recentTrades;
  const bias   = getSwingBias(lastKnownPrice);
  return {
    recentWinRate:     recent.length ? recent.filter(t => t.isWin).length / recent.length : null,
    consecutiveLosses: performance.consecutiveLosses,
    byType:            performance.byType,
    conditions:        performance.conditions,
    totalTrades:       performance.totalTrades,
    swingBias: {
      active:         bias.biasActive,
      direction:      bias.biasDir,
      daysRemaining:  bias.daysRemaining || 0,
      nextTarget:     bias.nextTarget    || null,
      inDiscountZone: bias.inDiscountZone,
      invalidated:    bias.invalidated   || false,
      endDate:        SWING_BIAS.endDate.toISOString().slice(0, 10),
    },
  };
}

// ── YOUR HISTORICAL PATTERNS ──────────────────────────────────────────────────
const YOUR_PATTERNS = {
  bestHoursUTC:     [1, 5, 15],
  worstHoursUTC:    [2, 3, 4, 16, 19],
  breakEvenWinRate: 0.37,
};

function getLiveWinRate() {
  const recent = performance.recentTrades;
  if (!recent.length) return 0.5;
  return recent.filter(t => t.isWin).length / recent.length;
}

function getDominantDirection() {
  const buys  = performance.recentTrades.filter(t => t.type === 'buy');
  const sells = performance.recentTrades.filter(t => t.type === 'sell');
  if (!buys.length && !sells.length) return null;
  const buyWR  = buys.length  ? buys.filter(t => t.isWin).length  / buys.length  : 0;
  const sellWR = sells.length ? sells.filter(t => t.isWin).length / sells.length : 0;
  return buyWR >= sellWR ? 'buy' : 'sell';
}

// ── TIMEFRAME SLICE SIZES (bars at ~20s intervals) ────────────────────────────
// 1min  = 3 bars,  5min = 15, 15min = 45, 1hr = 180, 4hr = 720, Daily = 4320
const TF = {
  m1:  3,
  m5:  15,
  m15: 45,
  h1:  180,
  h4:  720,
  d1:  4320,
};

// ── 30-DAY SWING BIAS (chart-based directional projection) ───────────────────
// Updated from chart analysis: Nov 14 2026 — price at ~3,884 deep discount zone
// Daily: massive downtrend from 4,200 → 3,860. Historical pattern + demand zone
// Projection: swing UP toward new highs over next 30 days
// This bias is applied as a moderate bull lean that decays after 30 days,
// then permanently replaced by MTF confirmation logic only.
const SWING_BIAS = {
  active:        true,
  direction:     'bull',          // chart projection: up toward new highs
  startDate:     new Date('2026-11-14T00:00:00Z'),
  endDate:       new Date('2026-12-14T00:00:00Z'),
  // Key levels from chart analysis (used to validate the bias is still intact)
  invalidateBelow: 3799.56,       // daily structure low — if broken, bias is off
  targetZones:   [3916.89, 3948.62, 3976.15, 4031.07, 4071.97, 4145.86, 4199.08],
  // Weight added to bull score while bias is active and price is above invalidation
  weight:        1.5,
  // Key support cluster where buys are highest conviction during bias period
  discountZone:  { low: 3852.59, high: 3905.31 },
};

function getSwingBias(currentPrice) {
  if (!SWING_BIAS.active) return { biasActive: false, biasDir: null, biasWeight: 0, inDiscountZone: false };
  const now = new Date();
  if (now > SWING_BIAS.endDate) {
    SWING_BIAS.active = false; // bias expired — MTF confirmation takes over permanently
    return { biasActive: false, biasDir: null, biasWeight: 0, inDiscountZone: false };
  }
  if (currentPrice < SWING_BIAS.invalidateBelow) {
    // Structure broken — bias invalidated, switch to neutral
    return { biasActive: false, biasDir: null, biasWeight: 0, inDiscountZone: false, invalidated: true };
  }
  const daysRemaining = (SWING_BIAS.endDate - now) / (1000 * 60 * 60 * 24);
  const decayFactor   = Math.min(daysRemaining / 30, 1); // weight fades as deadline approaches
  const inDiscountZone = currentPrice >= SWING_BIAS.discountZone.low && currentPrice <= SWING_BIAS.discountZone.high;
  // Next target above current price
  const nextTarget = SWING_BIAS.targetZones.find(t => t > currentPrice) || SWING_BIAS.targetZones[SWING_BIAS.targetZones.length - 1];
  return {
    biasActive: true,
    biasDir: SWING_BIAS.direction,
    biasWeight: SWING_BIAS.weight * decayFactor,
    inDiscountZone,
    nextTarget,
    daysRemaining: Math.round(daysRemaining),
  };
}

// ── MULTI-TIMEFRAME STRUCTURE ANALYSIS ───────────────────────────────────────
// Core concepts:
//   Break of Structure (BOS): price closes beyond a previous swing high/low → trend continuation
//   Change of Character (CHoCH): price closes beyond the OPPOSITE swing → trend reversal signal
//   Liquidity Sweep: price briefly wicks beyond a swing high/low, then reverses → stop hunt complete
//   Fair Value Gap (FVG): 3-candle imbalance — price tends to return to fill it
//   Premium/Discount zones: above midpoint of range = premium (look to sell), below = discount (look to buy)

function buildBars(prices) {
  // Convert flat price array into OHLC-like bars (each adjacent pair = 1 bar)
  const bars = [];
  for (let i = 1; i < prices.length; i++) {
    const o = prices[i - 1], c = prices[i];
    bars.push({ open: o, close: c, high: Math.max(o, c), low: Math.min(o, c) });
  }
  return bars;
}

function getSwingPoints(bars, lookback = 3) {
  // Find swing highs and lows using left/right comparison
  const swingHighs = [], swingLows = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    const h = bars[i].high;
    const l = bars[i].low;
    let isHigh = true, isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (bars[i - j].high >= h || bars[i + j].high >= h) isHigh = false;
      if (bars[i - j].low  <= l || bars[i + j].low  <= l) isLow  = false;
    }
    if (isHigh) swingHighs.push({ price: h, index: i });
    if (isLow)  swingLows.push({ price: l, index: i });
  }
  return { swingHighs, swingLows };
}

function detectBreakOfStructure(bars) {
  if (bars.length < 10) return { bosBull: false, bosBear: false, chochBull: false, chochBear: false };
  const { swingHighs, swingLows } = getSwingPoints(bars.slice(-40), 2);

  const lastHigh = swingHighs.length ? swingHighs[swingHighs.length - 1].price : null;
  const lastLow  = swingLows.length  ? swingLows[swingLows.length - 1].price   : null;
  const prevHigh = swingHighs.length > 1 ? swingHighs[swingHighs.length - 2].price : null;
  const prevLow  = swingLows.length  > 1 ? swingLows[swingLows.length - 2].price   : null;

  const lastBar  = bars[bars.length - 1];
  const lastClose = lastBar.close;

  // BOS Bull: close above last swing high (trend continuation up)
  const bosBull = lastHigh && lastClose > lastHigh;
  // BOS Bear: close below last swing low (trend continuation down)
  const bosBear = lastLow  && lastClose < lastLow;

  // CHoCH Bull: in a downtrend, price breaks above a previous swing high (reversal signal)
  const chochBull = prevHigh && lastClose > prevHigh && !bosBull;
  // CHoCH Bear: in an uptrend, price breaks below a previous swing low (reversal signal)
  const chochBear = prevLow  && lastClose < prevLow  && !bosBear;

  return {
    bosBull, bosBear, chochBull, chochBear,
    lastSwingHigh: lastHigh, lastSwingLow: lastLow,
  };
}

function detectLiquiditySweep(bars) {
  // A liquidity sweep = price briefly wicks past a swing high/low then closes back inside
  // This clears out stop orders → often precedes a strong reversal
  if (bars.length < 10) return { sweepBull: false, sweepBear: false };

  const { swingHighs, swingLows } = getSwingPoints(bars.slice(-30), 2);
  const recent = bars.slice(-5);
  const lastBar = bars[bars.length - 1];

  // Bull sweep: wick below a swing low but closes back above it (stops cleared, reversal up)
  const nearestLow  = swingLows.length  ? swingLows[swingLows.length - 1].price  : null;
  const nearestHigh = swingHighs.length ? swingHighs[swingHighs.length - 1].price : null;

  const sweepBull = nearestLow &&
    recent.some(b => b.low < nearestLow) &&
    lastBar.close > nearestLow;

  // Bear sweep: wick above a swing high but closes back below it (stops cleared, reversal down)
  const sweepBear = nearestHigh &&
    recent.some(b => b.high > nearestHigh) &&
    lastBar.close < nearestHigh;

  return {
    sweepBull, sweepBear,
    sweptLow:  sweepBull ? nearestLow  : null,
    sweptHigh: sweepBear ? nearestHigh : null,
  };
}

function detectFVGsFromBars(bars) {
  // Fair Value Gaps from OHLC bars (more accurate than close-only version)
  const bullish = [], bearish = [];
  for (let i = 0; i < bars.length - 2; i++) {
    const c1 = bars[i], c3 = bars[i + 2];
    // Bullish FVG: gap between bar1 high and bar3 low
    if (c3.low > c1.high) {
      bullish.push({ top: c3.low, bottom: c1.high, midpoint: (c3.low + c1.high) / 2, age: bars.length - i });
    }
    // Bearish FVG: gap between bar1 low and bar3 high
    if (c3.high < c1.low) {
      bearish.push({ top: c1.low, bottom: c3.high, midpoint: (c1.low + c3.high) / 2, age: bars.length - i });
    }
  }
  return { bullish: bullish.slice(-5), bearish: bearish.slice(-5) };
}

function detectFVGReaction(bars, currentPrice) {
  // Is price currently reacting AT a FVG level?
  // "Reaction" = price entered the FVG zone and showed a reversal candle
  const { bullish, bearish } = detectFVGsFromBars(bars);
  const zone = currentPrice * 0.001;
  const lastBar = bars[bars.length - 1];

  // Bull reaction: price touched a bullish FVG (support) and last bar closed bullish
  const nearBullFVG = bullish.find(g => currentPrice >= g.bottom - zone && currentPrice <= g.top + zone);
  const fvgReactionBull = nearBullFVG && lastBar.close > lastBar.open;

  // Bear reaction: price touched a bearish FVG (resistance) and last bar closed bearish
  const nearBearFVG = bearish.find(g => currentPrice >= g.bottom - zone && currentPrice <= g.top + zone);
  const fvgReactionBear = nearBearFVG && lastBar.close < lastBar.open;

  return {
    fvgReactionBull: !!fvgReactionBull,
    fvgReactionBear: !!fvgReactionBear,
    nearBullFVG, nearBearFVG,
    allBullFVGs: bullish,
    allBearFVGs: bearish,
  };
}

function getPremiumDiscount(bars, currentPrice) {
  // Premium = above 50% of the range (overpriced, look to sell)
  // Discount = below 50% of the range (underpriced, look to buy)
  if (!bars.length) return { inPremium: false, inDiscount: false, equilibrium: 0 };
  const high = Math.max(...bars.map(b => b.high));
  const low  = Math.min(...bars.map(b => b.low));
  const equilibrium = (high + low) / 2;
  const inPremium  = currentPrice > equilibrium;
  const inDiscount = currentPrice < equilibrium;
  // How far into premium/discount (0 = equilibrium, 1 = at the extreme)
  const rangeSize = high - low || 1;
  const pct = (currentPrice - low) / rangeSize; // 0=bottom, 1=top, 0.5=mid
  return { inPremium, inDiscount, equilibrium, pct, rangeHigh: high, rangeLow: low };
}

// ── FULL MULTI-TIMEFRAME STRUCTURE ANALYSIS ───────────────────────────────────
// Runs structure analysis on all 6 timeframes and returns a unified signal
function computeMTFStructure(currentPrice, history) {
  const result = {};

  const timeframes = [
    { name: 'm1',  bars: TF.m1  },
    { name: 'm5',  bars: TF.m5  },
    { name: 'm15', bars: TF.m15 },
    { name: 'h1',  bars: TF.h1  },
    { name: 'h4',  bars: TF.h4  },
    { name: 'd1',  bars: TF.d1  },
  ];

  let bullSignals = 0, bearSignals = 0;

  for (const tf of timeframes) {
    const slice  = history.slice(-Math.min(tf.bars + 2, history.length));
    if (slice.length < 5) {
      result[tf.name] = { insufficient: true };
      continue;
    }
    const bars   = buildBars(slice);
    const bos    = detectBreakOfStructure(bars);
    const sweep  = detectLiquiditySweep(bars);
    const fvgR   = detectFVGReaction(bars, currentPrice);
    const pd     = getPremiumDiscount(bars, currentPrice);
    const { swingHighs, swingLows } = getSwingPoints(bars, 2);

    // Key S/R from swing structure on this TF
    const keyResistance = swingHighs.length ? swingHighs[swingHighs.length - 1].price : null;
    const keySupport    = swingLows.length  ? swingLows[swingLows.length - 1].price   : null;
    const zone = currentPrice * 0.001;
    const nearKeySupport    = keySupport    && Math.abs(currentPrice - keySupport)    < zone * 2;
    const nearKeyResistance = keyResistance && Math.abs(currentPrice - keyResistance) < zone * 2;

    result[tf.name] = {
      bos, sweep, fvgR, pd,
      keySupport, keyResistance,
      nearKeySupport, nearKeyResistance,
    };

    // Weight heavier timeframes more
    const weight = tf.name === 'd1' ? 3 : tf.name === 'h4' ? 2.5 : tf.name === 'h1' ? 2 : 1;

    // Bull signals on this TF
    if (bos.bosBull || bos.chochBull)   bullSignals += weight;
    if (sweep.sweepBull)                 bullSignals += weight * 1.5; // sweep = strong signal
    if (fvgR.fvgReactionBull)            bullSignals += weight;
    if (pd.inDiscount && nearKeySupport) bullSignals += weight;

    // Bear signals on this TF
    if (bos.bosBear || bos.chochBear)   bearSignals += weight;
    if (sweep.sweepBear)                 bearSignals += weight * 1.5;
    if (fvgR.fvgReactionBear)            bearSignals += weight;
    if (pd.inPremium && nearKeyResistance) bearSignals += weight;
  }

  // MTF alignment: HTF (d1+h4) agrees with LTF (m15+m5+m1)
  const htfBull = (result.d1?.bos?.bosBull || result.h4?.bos?.bosBull);
  const htfBear = (result.d1?.bos?.bosBear || result.h4?.bos?.bosBear);
  const ltfBull = (result.m15?.bos?.bosBull || result.m5?.sweep?.sweepBull || result.m1?.fvgR?.fvgReactionBull);
  const ltfBear = (result.m15?.bos?.bosBear || result.m5?.sweep?.sweepBear || result.m1?.fvgR?.fvgReactionBear);

  const mtfAlignedBull = htfBull && ltfBull;
  const mtfAlignedBear = htfBear && ltfBear;

  // Entry quality score (0-10)
  const totalSignals = bullSignals + bearSignals || 1;
  const bullPct = bullSignals / totalSignals;
  const entryQuality = Math.min(Math.max(bullSignals, bearSignals) / 10, 1);

  return {
    timeframes: result,
    bullSignals,
    bearSignals,
    mtfAlignedBull,
    mtfAlignedBear,
    htfBull, htfBear,
    ltfBull, ltfBear,
    entryQuality,
    // Current price context from h1
    h1Premium:  result.h1?.pd?.inPremium,
    h1Discount: result.h1?.pd?.inDiscount,
    h1Equilibrium: result.h1?.pd?.equilibrium,
    // Best entry zones from h4
    h4KeySupport:    result.h4?.keySupport,
    h4KeyResistance: result.h4?.keyResistance,
    // Most recent liquidity sweeps (high conviction signals)
    recentSweepBull: result.m5?.sweep?.sweepBull || result.m15?.sweep?.sweepBull,
    recentSweepBear: result.m5?.sweep?.sweepBear || result.m15?.sweep?.sweepBear,
    // FVG reactions on entry TFs
    fvgEntryBull: result.m5?.fvgR?.fvgReactionBull || result.m15?.fvgR?.fvgReactionBull,
    fvgEntryBear: result.m5?.fvgR?.fvgReactionBear || result.m15?.fvgR?.fvgReactionBear,
  };
}

// ── FAIR VALUE GAPS (legacy close-only version, kept for backwards compat) ────
function detectFairValueGaps(history) {
  const fvgs = { bullish: [], bearish: [], nearBullishFVG: false, nearBearishFVG: false };
  if (history.length < 5) return fvgs;
  const bars = buildBars(history.slice(-100));
  const { bullish, bearish } = detectFVGsFromBars(bars);
  fvgs.bullish = bullish;
  fvgs.bearish = bearish;
  const last = history[history.length - 1];
  const zone = last * 0.0015;
  fvgs.nearBullishFVG = bullish.some(g => last >= g.bottom - zone && last <= g.top + zone);
  fvgs.nearBearishFVG = bearish.some(g => last >= g.bottom - zone && last <= g.top + zone);
  return fvgs;
}

// ── SUPPORT / RESISTANCE (enhanced with daily/4H pivots) ──────────────────────
function computeSRLevels(price, history) {
  if (history.length < 20) return { nearSupport: false, nearResistance: false, srStrength: 0 };

  const recent = history.slice(-50);
  const highs = [], lows = [];
  for (let i = 2; i < recent.length - 2; i++) {
    if (recent[i] > recent[i-1] && recent[i] > recent[i-2] && recent[i] > recent[i+1] && recent[i] > recent[i+2]) highs.push(recent[i]);
    if (recent[i] < recent[i-1] && recent[i] < recent[i-2] && recent[i] < recent[i+1] && recent[i] < recent[i+2]) lows.push(recent[i]);
  }

  // HTF Pivot Points
  const htfPivots = [];
  const sliceSizes = [288, 144, 48];
  for (const sz of sliceSizes) {
    if (history.length >= sz) {
      const slice = history.slice(-sz);
      const hi = Math.max(...slice), lo = Math.min(...slice), cl = slice[slice.length - 1];
      const pp = (hi + lo + cl) / 3;
      htfPivots.push(pp, 2*pp - lo, 2*pp - hi, pp + (hi - lo), pp - (hi - lo));
    }
  }

  const allResistance = [...highs, ...htfPivots.filter(p => p > price)];
  const allSupport    = [...lows,  ...htfPivots.filter(p => p < price)];
  const ZONE = price * 0.001;
  const nearSupport    = allSupport.some(l => Math.abs(price - l) < ZONE);
  const nearResistance = allResistance.some(h => Math.abs(price - h) < ZONE);
  const srStrength = nearSupport || nearResistance
    ? Math.min(
        (nearSupport    ? allSupport.filter(l => Math.abs(price - l) < ZONE * 2).length    : 0) +
        (nearResistance ? allResistance.filter(h => Math.abs(price - h) < ZONE * 2).length : 0), 5)
    : 0;

  const nearestSupport    = allSupport.length    ? allSupport.reduce((a, b) => Math.abs(b - price) < Math.abs(a - price) ? b : a)    : null;
  const nearestResistance = allResistance.length ? allResistance.reduce((a, b) => Math.abs(b - price) < Math.abs(a - price) ? b : a) : null;

  return { nearSupport, nearResistance, srStrength, highs, lows, htfPivots, nearestSupport, nearestResistance };
}

// ── VOLUME (with price-direction confirmation) ────────────────────────────────
function computeVolume(history) {
  if (history.length < 20) return { volumeScore: 0, highVolume: false, lowVolume: false, volumeTrend: 'neutral' };

  const recent20 = history.slice(-20);
  const recent5  = history.slice(-5);
  const recent10 = history.slice(-10);
  const atr20 = recent20.slice(1).reduce((sum, p, i) => sum + Math.abs(p - recent20[i]), 0) / 19;
  const atr5  = recent5.slice(1).reduce((sum, p, i)  => sum + Math.abs(p - recent5[i]),  0) / 4;
  const atr10 = recent10.slice(1).reduce((sum, p, i) => sum + Math.abs(p - recent10[i]), 0) / 9;
  const volumeRatio  = atr5 / (atr20 || 0.001);
  const priceChange5 = recent5[recent5.length - 1] - recent5[0];
  const recentVolHigh = atr5 > atr10;
  const recentVolLow  = atr5 < atr10 * 0.7;

  let volumeTrend = 'neutral', risingWithPrice = false, fallingWithPrice = false, divergingFromPrice = false;
  if (priceChange5 > 0) {
    if (recentVolHigh)     { volumeTrend = 'confirming_bull'; risingWithPrice = true; }
    else if (recentVolLow) { volumeTrend = 'diverging_bull';  divergingFromPrice = true; }
  } else if (priceChange5 < 0) {
    if (recentVolHigh)     { volumeTrend = 'confirming_bear'; fallingWithPrice = true; }
    else if (recentVolLow) { volumeTrend = 'diverging_bear';  divergingFromPrice = true; }
  }

  return { volumeScore: volumeRatio, highVolume: volumeRatio > 1.5, lowVolume: volumeRatio < 0.5,
           atr20, atr5, atr10, volumeTrend, risingWithPrice, fallingWithPrice, divergingFromPrice,
           priceChange5, priceChange10: history[history.length-1] - history[Math.max(0, history.length-10)] };
}

// ── MULTI-TIMEFRAME (HTF bias) ────────────────────────────────────────────────
function computeHTF(price, history) {
  if (history.length < 40) return { htfBull: null, htfBear: null, confirmed: false };
  const h1_slice = history.slice(-40);
  const h4_slice = history.slice(-Math.min(160, history.length));
  const d1_slice = history.slice(-Math.min(480, history.length));
  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const h1_ma = avg(h1_slice), h4_ma = avg(h4_slice);
  const d1_ma = d1_slice.length >= 10 ? avg(d1_slice) : null;
  const h1_bull = price > h1_ma, h4_bull = price > h4_ma;
  const d1_bull = d1_ma ? price > d1_ma : null;
  const r = h1_slice;
  let g = 0, l = 0, gc = 0, lc = 0;
  for (let i = 1; i < r.length; i++) {
    const d = r[i] - r[i-1];
    if (d > 0) { g += d; gc++; } else { l += Math.abs(d); lc++; }
  }
  const h1_rsi = 100 - (100 / (1 + (gc ? g/gc : 0) / (lc ? l/lc : 0.001)));
  const htfHigh = Math.max(...h4_slice), htfLow = Math.min(...h4_slice), htfMid = (htfHigh + htfLow) / 2;
  const d1High = d1_slice.length ? Math.max(...d1_slice) : htfHigh;
  const d1Low  = d1_slice.length ? Math.min(...d1_slice) : htfLow;
  const d1Mid  = (d1High + d1Low) / 2;
  const htfZone = price * 0.002;
  const nearHTFSupport    = [htfLow, d1Low, htfMid, d1Mid].some(lvl => Math.abs(price - lvl) < htfZone && price >= lvl);
  const nearHTFResistance = [htfHigh, d1High, htfMid, d1Mid].some(lvl => Math.abs(price - lvl) < htfZone && price <= lvl);
  const htfBull = h1_bull && h4_bull && h1_rsi < 65;
  const htfBear = !h1_bull && !h4_bull && h1_rsi > 35;
  const fullBullAlign = d1_bull === true  && h4_bull && h1_bull;
  const fullBearAlign = d1_bull === false && !h4_bull && !h1_bull;
  return { htfBull, htfBear, h1_bull, h4_bull, d1_bull, h1_rsi, confirmed: htfBull || htfBear,
           fullBullAlign, fullBearAlign, htfHigh, htfLow, htfMid, d1High, d1Low, d1Mid,
           nearHTFSupport, nearHTFResistance };
}

// ── SPREAD MONITOR ────────────────────────────────────────────────────────────
let spreadHistory = [];
function updateSpread(bid, ask) {
  if (!bid || !ask) return;
  spreadHistory.push(ask - bid);
  if (spreadHistory.length > 50) spreadHistory.shift();
}
function getSpreadScore(currentSpread) {
  if (spreadHistory.length < 5) return { spreadOk: true, spreadRatio: 1 };
  const avg = spreadHistory.reduce((a, b) => a + b, 0) / spreadHistory.length;
  const ratio = currentSpread / (avg || 0.001);
  return { spreadOk: ratio < 2.0, spreadRatio: ratio, avgSpread: avg };
}

const LOT_PROGRESSION = [0.01, 0.02, 0.04, 0.08, 0.16, 0.32];
const BASE_LOT = 0.01;
function getLotSize(w) { return LOT_PROGRESSION[Math.min(w, LOT_PROGRESSION.length - 1)]; }

const TRADE_TARGETS = {
  scalp: { pips_tp: 3,   pips_sl: 0.75 },
  day:   { pips_tp: 10,  pips_sl: 3    },
  swing: { pips_tp: 100, pips_sl: 50   },
};

const MAX_LOSS_PER_TRADE    = 15;
const MARKET_CLOSE_HOUR_UTC = 21;
const MARKET_OPEN_HOUR_UTC  = 22;
const MAX_HISTORY = 1000;
let priceHistory   = [];
let lastKnownPrice = 4289.68;

function pushPrice(p) { priceHistory.push(p); if (priceHistory.length > MAX_HISTORY) priceHistory.shift(); }
function getHistory() { return [...priceHistory]; }

const fetch = require('node-fetch');

// ── PRICE FETCH ───────────────────────────────────────────────────────────────
async function fetchLivePrice() {
  try {
    const r = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1m&range=1d',
      { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }, timeout: 5000 }
    );
    if (r.ok) {
      const d = await r.json();
      const p = parseFloat(d?.chart?.result?.[0]?.meta?.regularMarketPrice);
      if (p > 1800 && p < 7000) { lastKnownPrice = p; console.log(`[Price] Yahoo Finance → $${p}`); return { price: p, source: 'Yahoo Finance' }; }
    }
  } catch (e) { console.log(`[Price] Yahoo: ${e.message}`); }

  try {
    const key = process.env.TWELVE_DATA_KEY;
    if (key) {
      const r = await fetch(`https://api.twelvedata.com/price?symbol=XAU/USD&apikey=${key}`, { timeout: 5000 });
      if (r.ok) {
        const d = await r.json();
        const p = parseFloat(d?.price);
        if (p > 1800 && p < 7000) { lastKnownPrice = p; return { price: p, source: 'Twelve Data' }; }
      }
    }
  } catch (e) { console.log(`[Price] Twelve Data: ${e.message}`); }

  try {
    const apiKey = process.env.OANDA_API_KEY;
    if (apiKey) {
      const accR = await fetch('https://api-fxtrade.oanda.com/v3/accounts', { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 5000 });
      if (accR.ok) {
        const accD = await accR.json();
        const accountId = accD?.accounts?.[0]?.id;
        if (accountId) {
          const r = await fetch(`https://api-fxtrade.oanda.com/v3/accounts/${accountId}/pricing?instruments=XAU_USD`, { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 5000 });
          if (r.ok) {
            const d = await r.json();
            const priceData = d?.prices?.[0];
            if (priceData) {
              const bid = parseFloat(priceData.bids?.[0]?.price);
              const ask = parseFloat(priceData.asks?.[0]?.price);
              updateSpread(bid, ask);
              const mid = parseFloat(((bid + ask) / 2).toFixed(2));
              if (mid > 1800 && mid < 7000) { lastKnownPrice = mid; return { price: mid, source: 'OANDA Live', bid, ask, spread: ask - bid }; }
            }
          }
        }
      }
    }
  } catch (e) { console.log(`[Price] OANDA: ${e.message}`); }

  try {
    const r = await fetch('https://data-asg.goldprice.org/dbXRates/USD', { headers: { Accept: 'application/json' }, timeout: 5000 });
    if (r.ok) {
      const d = await r.json();
      const p = parseFloat(d?.items?.[0]?.xauPrice);
      if (p > 1800 && p < 7000) { lastKnownPrice = p; return { price: p, source: 'goldprice.org' }; }
    }
  } catch (_) {}

  const drift = (Math.random() - 0.48) * 0.5;
  return { price: parseFloat((lastKnownPrice + drift).toFixed(2)), source: 'simulated' };
}

// ── INDICATORS ────────────────────────────────────────────────────────────────
function computeIndicators(price, history) {
  const len = history.length;
  if (len < 5) return null;
  const slice = n => history.slice(-Math.min(n, len));
  const avg   = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const ma5 = avg(slice(5)), ma14 = avg(slice(14)), ma21 = avg(slice(21));
  const r14 = slice(14);
  let g = 0, l = 0, gc = 0, lc = 0;
  for (let i = 1; i < r14.length; i++) {
    const d = r14[i] - r14[i-1];
    if (d > 0) { g += d; gc++; } else { l += Math.abs(d); lc++; }
  }
  const rsi   = 100 - (100 / (1 + (gc ? g/gc : 0) / (lc ? l/lc : 0.001)));
  const st    = slice(14), hi = Math.max(...st), lo = Math.min(...st);
  const stoch = hi !== lo ? ((price - lo) / (hi - lo)) * 100 : 50;
  const macd  = avg(slice(12)) - avg(slice(26));
  const momentum = len >= 5 ? price - history[len-5] : 0;
  const s14 = slice(14);
  const diffs = s14.slice(1).map((v, i) => Math.abs(v - s14[i]));
  const vol = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0.5;
  return { rsi, stoch, macd, momentum, vol, ma5, ma14, ma21, trend: price > ma14 ? 'bull' : 'bear', ema_align: ma5 > ma14 && ma14 > ma21 };
}

// ── SESSION QUALITY ───────────────────────────────────────────────────────────
function isGoodSession() {
  const h = new Date().getUTCHours();
  return (h >= 7 && h <= 10) || (h >= 12 && h <= 16);
}

// ── ICC PATTERN ───────────────────────────────────────────────────────────────
function detectICC(history) {
  if (history.length < 15) return { iccBull: false, iccBear: false };
  const recent = history.slice(-15);
  const mid    = Math.floor(recent.length / 2);
  const firstHalf  = recent.slice(0, mid);
  const secondHalf = recent.slice(mid);
  const firstMove  = firstHalf[firstHalf.length - 1] - firstHalf[0];
  const secondMove = secondHalf[secondHalf.length - 1] - secondHalf[0];
  const pullback   = recent[mid] - firstHalf[firstHalf.length - 1];
  const iccBull = firstMove > 0 && pullback < 0 && Math.abs(pullback) < firstMove * 0.618 && secondMove > 0;
  const iccBear = firstMove < 0 && pullback > 0 && Math.abs(pullback) < Math.abs(firstMove) * 0.618 && secondMove < 0;
  return { iccBull, iccBear, firstMove, pullback, secondMove };
}

// ── SWING REENTRY ─────────────────────────────────────────────────────────────
function checkSwingReentry(price, history, direction, htf, vol) {
  if (!direction || !htf) return { shouldReenter: false };
  const aligned = direction === 'buy' ? htf.htfBull : htf.htfBear;
  const hasVol  = vol && vol.highVolume;
  const shouldReenter = aligned && hasVol;
  return { shouldReenter, reason: shouldReenter ? 'HTF aligned + volume confirmed reentry' : 'Conditions not met' };
}

// ── DECISION ENGINE ───────────────────────────────────────────────────────────
function decide(price, indicators, hourUTC, consecutiveWins, tradeType = 'scalp', extraData = {}) {
  const target = TRADE_TARGETS[tradeType];
  const lots   = getLotSize(consecutiveWins);

  const now        = new Date();
  const hourUTCnow = now.getUTCHours();
  const dayUTC     = now.getUTCDay();

  const isSaturdayClosed = dayUTC === 6;
  const isSundayPreOpen  = dayUTC === 0 && hourUTCnow < 23;
  const isDailyBreak     = hourUTCnow >= 21 && hourUTCnow < 22;
  const isFridayClose    = dayUTC === 5 && hourUTCnow >= 21;

  const isMarketClosed = isSaturdayClosed || isSundayPreOpen || isDailyBreak || isFridayClose;
  if (isMarketClosed) {
    return { action:'wait', tradeType, reason:`Market closed — ${isSaturdayClosed?'Saturday':isSundayPreOpen?'Sunday pre-open':isDailyBreak?'Daily break 5-6pm EST':'Friday close'}`, confidence:0, bullScore:0, bearScore:0 };
  }

  const { spread } = extraData;
  if (spread) {
    const sc = getSpreadScore(spread);
    if (!sc.spreadOk) return { action:'wait', tradeType, reason:`Spread too wide (${sc.spreadRatio.toFixed(1)}x)`, confidence:0, bullScore:0, bearScore:0 };
  }

  const sizeM = getSizeMultiplier(0.5);
  if (sizeM === 0) return { action:'wait', tradeType, reason:`Paused — ${performance.consecutiveLosses} straight losses`, confidence:0, bullScore:0, bearScore:0 };

  const makeDecision = (action, reason, conf, conditions) => {
    const sl_dist = Math.min(target.pips_sl, MAX_LOSS_PER_TRADE / (lots * 100));
    const tp = action === 'buy' ? parseFloat((price + target.pips_tp).toFixed(2)) : parseFloat((price - target.pips_tp).toFixed(2));
    const sl = action === 'buy' ? parseFloat((price - sl_dist).toFixed(2))         : parseFloat((price + sl_dist).toFixed(2));
    return { action, tradeType, reason, confidence: conf, bullScore: bull, bearScore: bear, tp, sl, lots, conditions };
  };

  if (!indicators) return makeDecision(Math.random() > 0.5 ? 'buy' : 'sell', 'Building history', 0.5, []);

  const { rsi, stoch, macd, momentum, trend, ema_align } = indicators;
  const isBest  = YOUR_PATTERNS.bestHoursUTC.includes(hourUTC);
  const isWorst = YOUR_PATTERNS.worstHoursUTC.includes(hourUTC);
  let bull = 0, bear = 0;
  const log = [], activeConditions = [];

  // Live directional bias from recent performance
  const dominantDir = getDominantDirection();
  const liveWR = getLiveWinRate();
  if (dominantDir === 'buy'  && liveWR > YOUR_PATTERNS.breakEvenWinRate) { bull += 0.5; log.push(`Live bias: buy (${(liveWR*100).toFixed(0)}%WR)`); }
  if (dominantDir === 'sell' && liveWR > YOUR_PATTERNS.breakEvenWinRate) { bear += 0.5; log.push(`Live bias: sell (${(liveWR*100).toFixed(0)}%WR)`); }

  // ── HTF Bias ─────────────────────────────────────────────────────────────────
  const htf = extraData.htf || computeHTF(price, priceHistory);
  if (htf.htfBull)       { bull += getConditionWeight('htf_confirmed', 2); log.push('HTF bull'); activeConditions.push('htf_confirmed'); }
  else if (htf.htfBear)  { bear += getConditionWeight('htf_confirmed', 2); log.push('HTF bear'); activeConditions.push('htf_confirmed'); }
  else                   { bull -= 0.5; bear -= 0.5; log.push('HTF conflicted'); activeConditions.push('htf_conflicted'); }
  if (htf.fullBullAlign) { bull += 1.5; log.push('D1+H4+H1 bull'); }
  if (htf.fullBearAlign) { bear += 1.5; log.push('D1+H4+H1 bear'); }
  if (htf.nearHTFSupport)    { bull += getConditionWeight('htf_sr_support', 1.5);    log.push('Near HTF S'); activeConditions.push('htf_sr_support'); }
  if (htf.nearHTFResistance) { bear += getConditionWeight('htf_sr_resistance', 1.5); log.push('Near HTF R'); activeConditions.push('htf_sr_resistance'); }

  // ── MTF Structure (the new engine) ───────────────────────────────────────────
  const mtf = extraData.mtf || computeMTFStructure(price, priceHistory);

  // MTF alignment (HTF + LTF agree = highest conviction entry)
  if (mtf.mtfAlignedBull) {
    bull += getConditionWeight('mtf_aligned_bull', 3);
    log.push('MTF aligned BULL');
    activeConditions.push('mtf_aligned_bull');
  }
  if (mtf.mtfAlignedBear) {
    bear += getConditionWeight('mtf_aligned_bear', 3);
    log.push('MTF aligned BEAR');
    activeConditions.push('mtf_aligned_bear');
  }

  // Break of Structure signals
  if (mtf.timeframes.h1?.bos?.bosBull || mtf.timeframes.h4?.bos?.bosBull) {
    bull += getConditionWeight('bos_bull', 2);
    log.push('BOS bull (H1/H4)');
    activeConditions.push('bos_bull');
  }
  if (mtf.timeframes.h1?.bos?.bosBear || mtf.timeframes.h4?.bos?.bosBear) {
    bear += getConditionWeight('bos_bear', 2);
    log.push('BOS bear (H1/H4)');
    activeConditions.push('bos_bear');
  }

  // Liquidity sweeps = strong reversal signals
  if (mtf.recentSweepBull) {
    bull += getConditionWeight('liquidity_sweep_bull', 2.5);
    log.push('Liq sweep bull (stops cleared)');
    activeConditions.push('liquidity_sweep_bull');
  }
  if (mtf.recentSweepBear) {
    bear += getConditionWeight('liquidity_sweep_bear', 2.5);
    log.push('Liq sweep bear (stops cleared)');
    activeConditions.push('liquidity_sweep_bear');
  }

  // FVG reactions on entry timeframes (m5/m15)
  if (mtf.fvgEntryBull) {
    bull += getConditionWeight('fvg_reaction_bull', 2);
    log.push('FVG reaction bull (m5/m15)');
    activeConditions.push('fvg_reaction_bull');
  }
  if (mtf.fvgEntryBear) {
    bear += getConditionWeight('fvg_reaction_bear', 2);
    log.push('FVG reaction bear (m5/m15)');
    activeConditions.push('fvg_reaction_bear');
  }

  // Premium/Discount context from H1 (Sci's key concept: buy discount, sell premium)
  if (mtf.h1Discount) {
    bull += getConditionWeight('discount_zone', 1.5);
    log.push('H1 discount zone (buy bias)');
    activeConditions.push('discount_zone');
  }
  if (mtf.h1Premium) {
    bear += getConditionWeight('premium_zone', 1.5);
    log.push('H1 premium zone (sell bias)');
    activeConditions.push('premium_zone');
  }

  // Counter-bias: don't buy in premium, don't sell in discount
  if (mtf.h1Premium  && bull > bear) { bull -= 1; log.push('Caution: buying in premium'); }
  if (mtf.h1Discount && bear > bull) { bear -= 1; log.push('Caution: selling in discount'); }

  // ── 30-Day Swing Bias (chart-projection: bull toward new highs, Nov 14 – Dec 14) ──
  const swingBias = getSwingBias(price);
  if (swingBias.biasActive && swingBias.biasDir === 'bull') {
    bull += swingBias.biasWeight;
    log.push(`30d swing bias bull (+${swingBias.biasWeight.toFixed(1)}, ${swingBias.daysRemaining}d left)`);
    activeConditions.push('bias_bull');
    if (swingBias.inDiscountZone) {
      bull += 1.5; // extra weight when in the chart's identified discount zone
      log.push(`In swing discount zone → next target ~${swingBias.nextTarget}`);
      activeConditions.push('discount_zone');
    }
  } else if (swingBias.invalidated) {
    bear += 1; // structure broke below 3799 — flip to caution
    log.push('⚠ Swing bias invalidated (below 3799)');
  }
  // After bias expires: MTF confirmation carries full weight (already scored above)

  // ── S/R Levels ────────────────────────────────────────────────────────────────
  const sr = extraData.sr || computeSRLevels(price, priceHistory);
  if (sr.nearSupport)    { bull += getConditionWeight('near_support', 1.5) * (sr.srStrength / 3); log.push(`Near S (str:${sr.srStrength})`); activeConditions.push('near_support'); }
  if (sr.nearResistance) { bear += getConditionWeight('near_resistance', 1.5) * (sr.srStrength / 3); log.push(`Near R (str:${sr.srStrength})`); activeConditions.push('near_resistance'); }
  if (!sr.nearSupport && !sr.nearResistance) { bull -= 0.5; bear -= 0.5; log.push('Mid-range'); }

  // ── Volume Analysis ───────────────────────────────────────────────────────────
  const vol = extraData.vol || computeVolume(priceHistory);
  if (vol.highVolume) {
    const w = getConditionWeight('high_volume', 1.5); bull += w; bear += w;
    log.push(`Hi vol (${vol.volumeScore.toFixed(1)}x)`); activeConditions.push('high_volume');
  } else if (vol.lowVolume) {
    bull -= 1; bear -= 1; log.push(`Lo vol (${vol.volumeScore.toFixed(1)}x)`); activeConditions.push('low_volume');
  }
  if (vol.risingWithPrice)  { bull += getConditionWeight('volume_confirming', 1.5); log.push('Vol confirms bull'); activeConditions.push('volume_confirming'); }
  if (vol.fallingWithPrice) { bear += getConditionWeight('volume_confirming', 1.5); log.push('Vol confirms bear'); activeConditions.push('volume_confirming'); }
  if (vol.divergingFromPrice) {
    if (vol.priceChange5 > 0) { bull -= 1.5; log.push('Vol diverging↑'); activeConditions.push('volume_diverging'); }
    else                      { bear -= 1.5; log.push('Vol diverging↓'); activeConditions.push('volume_diverging'); }
  }

  // ── Legacy FVG (near gap) ─────────────────────────────────────────────────────
  const fvgData = extraData.fvg || detectFairValueGaps(priceHistory);
  if (fvgData.nearBullishFVG) { bull += getConditionWeight('fvg_bullish', 1.5); log.push('In bullish FVG'); activeConditions.push('fvg_bullish'); }
  if (fvgData.nearBearishFVG) { bear += getConditionWeight('fvg_bearish', 1.5); log.push('In bearish FVG'); activeConditions.push('fvg_bearish'); }

  // ── Standard Indicators ───────────────────────────────────────────────────────
  if (rsi < 40)        { const w = getConditionWeight('rsi_oversold_bull', 2);    bull += w; log.push(`RSI bull ${rsi.toFixed(0)}`); activeConditions.push('rsi_oversold_bull'); }
  else if (rsi > 60)   { const w = getConditionWeight('rsi_overbought_bear', 2);  bear += w; log.push(`RSI bear ${rsi.toFixed(0)}`); activeConditions.push('rsi_overbought_bear'); }
  if (stoch < 30)      { const w = getConditionWeight('stoch_oversold_bull', 2);  bull += w; log.push('Stoch OS'); activeConditions.push('stoch_oversold_bull'); }
  else if (stoch > 70) { const w = getConditionWeight('stoch_overbought_bear', 2);bear += w; log.push('Stoch OB'); activeConditions.push('stoch_overbought_bear'); }
  if (macd > 0)        { const w = getConditionWeight('macd_bull', 1); bull += w; log.push('MACD bull'); activeConditions.push('macd_bull'); }
  else                 { const w = getConditionWeight('macd_bear', 1); bear += w; log.push('MACD bear'); activeConditions.push('macd_bear'); }
  if (ema_align)       { const w = getConditionWeight('ema_bull_align', 2); bull += w; log.push('EMA bull'); activeConditions.push('ema_bull_align'); }
  else                 { const w = getConditionWeight('ema_bear_align', 1); bear += w; log.push('EMA bear'); activeConditions.push('ema_bear_align'); }
  if (momentum > 0)    { const w = getConditionWeight('momentum_up', 1);   bull += w; activeConditions.push('momentum_up'); }
  else                 { const w = getConditionWeight('momentum_down', 1);  bear += w; activeConditions.push('momentum_down'); }

  if (isWorst) { bull -= 1.5; bear -= 1.5; log.push('⚠ Worst hour'); activeConditions.push('worst_hour'); }
  if (isBest)  { bull += 1;   bear += 1;   log.push('✓ Best hour');  activeConditions.push('best_hour'); }

  // Symmetric trend alignment
  if (trend === 'bull') { bull += 1; log.push('Trend bull'); }
  else                  { bear += 1; log.push('Trend bear'); }

  // Symmetric performance feedback
  const buyPerf = performance.byType[`${tradeType}_buy`];
  if (buyPerf && (buyPerf.wins + buyPerf.losses) >= 5) {
    const wr = buyPerf.wins / (buyPerf.wins + buyPerf.losses);
    if (wr > 0.5)  { bull += 1;   log.push(`AI: buy WR ${(wr*100).toFixed(0)}%✓`); }
    if (wr < 0.3)  { bull -= 1.5; log.push(`AI: buy WR ${(wr*100).toFixed(0)}%✗`); }
  }
  const sellPerf = performance.byType[`${tradeType}_sell`];
  if (sellPerf && (sellPerf.wins + sellPerf.losses) >= 5) {
    const wr = sellPerf.wins / (sellPerf.wins + sellPerf.losses);
    if (wr > 0.5)  { bear += 1;   log.push(`AI: sell WR ${(wr*100).toFixed(0)}%✓`); }
    if (wr < 0.3)  { bear -= 1.5; log.push(`AI: sell WR ${(wr*100).toFixed(0)}%✗`); }
  }

  // Higher bar when MTF structure is active — require stronger conviction
  const hasMTFSignal = mtf.mtfAlignedBull || mtf.mtfAlignedBear || mtf.recentSweepBull || mtf.recentSweepBear;
  const topScore   = Math.max(bull, bear);
  const confidence = Math.min(topScore / 10, 1);
  const minScore   = performance.consecutiveLosses >= 3 ? 6 : hasMTFSignal ? 4 : 3;

  if (topScore < minScore) return { action:'wait', tradeType, reason:`Score ${topScore.toFixed(1)} < ${minScore} | ${log.join(' · ')}`, confidence, bullScore:bull, bearScore:bear };

  const action = bull >= bear ? 'buy' : 'sell';
  return makeDecision(action, `[${action.toUpperCase()}] B${bull.toFixed(1)}/S${bear.toFixed(1)} | ${log.join(' · ')}`, confidence, activeConditions);
}

module.exports = {
  fetchLivePrice, pushPrice, getHistory,
  computeIndicators, computeSRLevels, computeVolume, computeHTF,
  computeMTFStructure,
  detectFairValueGaps, detectBreakOfStructure, detectLiquiditySweep,
  decide, recordOutcome, resetLosses, getPerformanceSummary,
  detectICC, isGoodSession, checkSwingReentry,
  getLotSize, LOT_PROGRESSION, BASE_LOT,
  TRADE_TARGETS, YOUR_PATTERNS,
  MARKET_CLOSE_HOUR_UTC, MARKET_OPEN_HOUR_UTC,
  MAX_LOSS_PER_TRADE, updateSpread, getSpreadScore,
  getSwingBias, SWING_BIAS,
  seedPerformanceFromHistory, getPerformanceSnapshot, mergePerformanceSnapshot,
};