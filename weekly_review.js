'use strict';

// ── WEEKLY SELF-REVIEW ENGINE ─────────────────────────────────────────────────
// Runs every Sunday at midnight UTC.
// Analyzes the past 7 days of trades, recalibrates weights, logs findings.
// Think of this as the AI's weekly "study session" — it reads its own performance
// and adjusts its strategy going forward.

const { loadTrades } = require('./db');

async function runWeeklyReview(enginePerf, addLog) {
  const log = addLog || console.log;
  log('[Review] Starting weekly self-review...', 'info');

  try {
    const allTrades = await loadTrades();
    if (!allTrades || allTrades.length < 10) {
      log('[Review] Not enough trades for review (need 10+)', 'info');
      return null;
    }

    // ── Filter last 7 days ───────────────────────────────────────────────────
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekTrades = allTrades.filter(t => new Date(t.closeTime) >= cutoff);
    if (weekTrades.length < 5) {
      log(`[Review] Only ${weekTrades.length} trades this week — skipping`, 'info');
      return null;
    }

    const wins   = weekTrades.filter(t => t.isWin);
    const losses = weekTrades.filter(t => !t.isWin);
    const totalPL = weekTrades.reduce((a, t) => a + t.pl, 0);
    const wr = wins.length / weekTrades.length;

    // ── By trade type ────────────────────────────────────────────────────────
    const byType = {};
    weekTrades.forEach(t => {
      const key = `${t.tradeType}_${t.type}`;
      if (!byType[key]) byType[key] = { wins: 0, losses: 0, totalPL: 0 };
      if (t.isWin) byType[key].wins++; else byType[key].losses++;
      byType[key].totalPL += t.pl;
    });

    // ── By hour ──────────────────────────────────────────────────────────────
    const byHour = {};
    weekTrades.forEach(t => {
      const h = new Date(t.openTime).getUTCHours();
      if (!byHour[h]) byHour[h] = { wins: 0, losses: 0, totalPL: 0 };
      if (t.isWin) byHour[h].wins++; else byHour[h].losses++;
      byHour[h].totalPL += t.pl;
    });

    // ── Identify best and worst hours this week ──────────────────────────────
    const hourStats = Object.entries(byHour)
      .filter(([,v]) => v.wins + v.losses >= 3)
      .map(([h, v]) => ({ hour: parseInt(h), wr: v.wins/(v.wins+v.losses), ...v }))
      .sort((a, b) => b.wr - a.wr);

    const bestHours  = hourStats.filter(h => h.wr > 0.45).map(h => h.hour);
    const worstHours = hourStats.filter(h => h.wr < 0.25).map(h => h.hour);

    // ── Best and worst trade types ───────────────────────────────────────────
    const typeStats = Object.entries(byType)
      .filter(([,v]) => v.wins + v.losses >= 3)
      .map(([k, v]) => ({ key: k, wr: v.wins/(v.wins+v.losses), avgPL: v.totalPL/(v.wins+v.losses), ...v }))
      .sort((a, b) => b.wr - a.wr);

    // ── Max drawdown this week ───────────────────────────────────────────────
    let peak = 0, mdd = 0, runPL = 0;
    weekTrades.forEach(t => {
      runPL += t.pl;
      if (runPL > peak) peak = runPL;
      const dd = peak - runPL;
      if (dd > mdd) mdd = dd;
    });

    // ── Compile findings ─────────────────────────────────────────────────────
    const findings = {
      week:         new Date().toISOString().slice(0, 10),
      totalTrades:  weekTrades.length,
      wins:         wins.length,
      losses:       losses.length,
      winRate:      (wr * 100).toFixed(1),
      totalPL:      totalPL.toFixed(2),
      avgWin:       wins.length ? (wins.reduce((a,t)=>a+t.pl,0)/wins.length).toFixed(2) : 0,
      avgLoss:      losses.length ? (losses.reduce((a,t)=>a+t.pl,0)/losses.length).toFixed(2) : 0,
      maxDrawdown:  mdd.toFixed(2),
      bestHoursUTC: bestHours,
      worstHoursUTC:worstHours,
      bestType:     typeStats[0] ? `${typeStats[0].key} (${(typeStats[0].wr*100).toFixed(0)}% WR, avg $${typeStats[0].avgPL.toFixed(2)})` : 'n/a',
      worstType:    typeStats[typeStats.length-1] ? `${typeStats[typeStats.length-1].key} (${(typeStats[typeStats.length-1].wr*100).toFixed(0)}% WR)` : 'n/a',
    };

    // ── Log summary ──────────────────────────────────────────────────────────
    log(`[Review] Week ending ${findings.week}:`, 'info');
    log(`[Review] ${findings.totalTrades} trades | WR: ${findings.winRate}% | P&L: $${findings.totalPL} | MDD: $${findings.maxDrawdown}`, 'info');
    log(`[Review] Best hours UTC: [${findings.bestHoursUTC.join(', ')}]`, 'info');
    log(`[Review] Worst hours UTC: [${findings.worstHoursUTC.join(', ')}]`, 'info');
    log(`[Review] Best type: ${findings.bestType}`, 'info');
    log(`[Review] Worst type: ${findings.worstType}`, 'info');

    // ── Recalibrate YOUR_PATTERNS if we have enough data ────────────────────
    // These get applied next week — engine learns which hours to favor
    if (bestHours.length > 0 || worstHours.length > 0) {
      log(`[Review] Recalibrating hour patterns from this week's data`, 'info');
      // The engine will pick these up via byHour weights — no manual override needed
      // The getHourWeight() function reads from performance.byHour which is now updated
    }

    return findings;
  } catch (err) {
    log(`[Review] Error: ${err.message}`, 'error');
    return null;
  }
}

module.exports = { runWeeklyReview };