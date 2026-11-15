'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── CREATE TABLES IF NOT EXISTS ───────────────────────────────────────────────
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id          SERIAL PRIMARY KEY,
        trade_id    INTEGER,
        type        VARCHAR(10),
        entry       NUMERIC,
        exit        NUMERIC,
        tp          NUMERIC,
        sl          NUMERIC,
        lots        NUMERIC,
        pl          NUMERIC,
        is_win      BOOLEAN,
        open_time   TIMESTAMPTZ,
        close_time  TIMESTAMPTZ,
        close_reason VARCHAR(20),
        reason      TEXT,
        confidence  NUMERIC,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS equity_history (
        id         SERIAL PRIMARY KEY,
        balance    NUMERIC,
        recorded_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_summary (
        id          SERIAL PRIMARY KEY,
        date        DATE UNIQUE,
        trades      INTEGER,
        wins        INTEGER,
        losses      INTEGER,
        win_rate    NUMERIC,
        gross_pl    NUMERIC,
        balance     NUMERIC,
        avg_win     NUMERIC,
        avg_loss    NUMERIC,
        best_trade  NUMERIC,
        worst_trade NUMERIC,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS engine_state (
        id                     TEXT PRIMARY KEY,
        conditions             JSONB,
        by_type                JSONB,
        by_hour                JSONB,
        by_dow                 JSONB,
        by_price_zone          JSONB,
        combos                 JSONB,
        total_trades           INTEGER DEFAULT 0,
        consecutive_losses     INTEGER DEFAULT 0,
        max_consecutive_losses INTEGER DEFAULT 0,
        recent_trades          JSONB,
        atr_history            JSONB,
        saved_at               TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('[DB] Tables ready');
  } catch (err) {
    console.error('[DB] initDB error:', err.message);
  }
}

// ── SAVE ONE TRADE ─────────────────────────────────────────────────────────────
async function saveTrade(trade) {
  try {
    await pool.query(`
      INSERT INTO trades
        (trade_id, type, entry, exit, tp, sl, lots, pl, is_win, open_time, close_time, close_reason, reason, confidence)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    `, [
      trade.id, trade.type, trade.entry, trade.exit,
      trade.tp, trade.sl, trade.lots, trade.pl, trade.isWin,
      trade.openTime, trade.closeTime, trade.closeReason,
      trade.reason?.substring(0, 500), trade.confidence,
    ]);
    console.log(`[DB] Trade #${trade.id} saved`);
  } catch (err) {
    console.error('[DB] saveTrade error:', err.message);
  }
}

// ── SAVE EQUITY SNAPSHOT ──────────────────────────────────────────────────────
async function saveEquity(balance) {
  try {
    await pool.query(`INSERT INTO equity_history (balance) VALUES ($1)`, [balance]);
  } catch (err) {
    console.error('[DB] saveEquity error:', err.message);
  }
}

// ── SAVE DAILY SUMMARY ────────────────────────────────────────────────────────
async function saveDailySummary(data) {
  try {
    await pool.query(`
      INSERT INTO daily_summary
        (date, trades, wins, losses, win_rate, gross_pl, balance, avg_win, avg_loss, best_trade, worst_trade)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (date) DO UPDATE SET
        trades=$2, wins=$3, losses=$4, win_rate=$5, gross_pl=$6,
        balance=$7, avg_win=$8, avg_loss=$9, best_trade=$10, worst_trade=$11
    `, [
      data.date, data.trades, data.wins, data.losses,
      data.winRate, data.grossPL, data.balance,
      data.avgWin, data.avgLoss, data.best, data.worst,
    ]);
    console.log('[DB] Daily summary saved');
  } catch (err) {
    console.error('[DB] saveDailySummary error:', err.message);
  }
}

// ── LOAD ALL TRADES (on startup) ──────────────────────────────────────────────
async function loadTrades() {
  try {
    const result = await pool.query(`SELECT * FROM trades ORDER BY close_time ASC`);
    return result.rows.map(r => ({
      id:          r.trade_id,
      type:        r.type,
      entry:       parseFloat(r.entry),
      exit:        parseFloat(r.exit),
      tp:          parseFloat(r.tp),
      sl:          parseFloat(r.sl),
      lots:        parseFloat(r.lots),
      pl:          parseFloat(r.pl),
      isWin:       r.is_win,
      openTime:    r.open_time,
      closeTime:   r.close_time,
      closeReason: r.close_reason,
      reason:      r.reason,
      confidence:  parseFloat(r.confidence),
    }));
  } catch (err) {
    console.error('[DB] loadTrades error:', err.message);
    return [];
  }
}

// ── LOAD EQUITY HISTORY (on startup) ─────────────────────────────────────────
async function loadEquityHistory() {
  try {
    const result = await pool.query(`SELECT balance FROM equity_history ORDER BY recorded_at ASC`);
    return result.rows.map(r => parseFloat(r.balance));
  } catch (err) {
    console.error('[DB] loadEquityHistory error:', err.message);
    return [];
  }
}

// ── SAVE ENGINE PERFORMANCE STATE ─────────────────────────────────────────────
async function saveEngineState(snapshot) {
  try {
    await pool.query(`
      INSERT INTO engine_state
        (id, conditions, by_type, by_hour, by_dow, by_price_zone, combos,
         total_trades, consecutive_losses, max_consecutive_losses,
         recent_trades, atr_history, saved_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
      ON CONFLICT (id) DO UPDATE SET
        conditions=$2, by_type=$3, by_hour=$4, by_dow=$5,
        by_price_zone=$6, combos=$7, total_trades=$8,
        consecutive_losses=$9, max_consecutive_losses=$10,
        recent_trades=$11, atr_history=$12, saved_at=NOW()
    `, [
      'engine_performance',
      JSON.stringify(snapshot.conditions),
      JSON.stringify(snapshot.byType),
      JSON.stringify(snapshot.byHour    || {}),
      JSON.stringify(snapshot.byDOW     || {}),
      JSON.stringify(snapshot.byPriceZone || {}),
      JSON.stringify(snapshot.combos    || {}),
      snapshot.totalTrades,
      snapshot.consecutiveLosses,
      snapshot.maxConsecutiveLosses,
      JSON.stringify(snapshot.recentTrades || []),
      JSON.stringify(snapshot.atrHistory   || []),
    ]);
  } catch (err) {
    console.error('[DB] saveEngineState error:', err.message);
  }
}

// ── LOAD ENGINE PERFORMANCE STATE ─────────────────────────────────────────────
async function loadEngineState() {
  try {
    const result = await pool.query(`SELECT * FROM engine_state WHERE id = 'engine_performance'`);
    if (!result.rows.length) return null;
    const r = result.rows[0];
    return {
      conditions:           r.conditions,
      byType:               r.by_type,
      byHour:               r.by_hour,
      byDOW:                r.by_dow,
      byPriceZone:          r.by_price_zone,
      combos:               r.combos,
      totalTrades:          r.total_trades,
      consecutiveLosses:    r.consecutive_losses,
      maxConsecutiveLosses: r.max_consecutive_losses,
      recentTrades:         r.recent_trades,
      atrHistory:           r.atr_history,
    };
  } catch (err) {
    console.error('[DB] loadEngineState error:', err.message);
    return null;
  }
}

module.exports = {
  initDB, saveTrade, saveEquity, saveDailySummary,
  loadTrades, loadEquityHistory,
  saveEngineState, loadEngineState,
};