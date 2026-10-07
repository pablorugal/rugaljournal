/* =====================================================================
 * ARCHIVO GENERADO — NO EDITAR.
 * Fuente única de verdad: functions/src/calculations.ts
 * Para actualizar este archivo: npm run sync:calc (desde la raíz)
 * ===================================================================== */

import type {
  Trade, UserSettings, InstrumentType, Direction, TradingAccount, AccountPhase,
  HabitLog, HabitRule, DailyBiasEntry, MindsetEntry, Strategy, Checklist,
} from "./types";

/* ==================== COMISIONES ==================== */
export function getCommissionPerContract(symbol: string, settings: UserSettings) {
  const s = symbol.toUpperCase();
  if (s.includes("MNQ")) return settings.commission_mnq;
  if (s.includes("NQ")) return settings.commission_nq;
  return 0;
}
export function getTradeCommission(trade: Trade, settings: UserSettings) {
  return getCommissionPerContract(trade.symbol, settings) * (trade.position_size || 0);
}
export function getNetPnl(trade: Trade, settings: UserSettings) {
  return trade.pnl - getTradeCommission(trade, settings);
}
export function classifyTrade(trade: Trade, settings: UserSettings): "win" | "loss" | "be" {
  const net = getNetPnl(trade, settings);
  if (Math.abs(net) <= settings.breakeven_threshold) return "be";
  return net > 0 ? "win" : "loss";
}

/* ==================== CÁLCULO AUTOMÁTICO DE P&L ==================== */
export const CONTRACT_MULTIPLIERS: Record<string, number> = {
  MNQ: 2, NQ: 20,
  MES: 5, ES: 50,
  MYM: 0.5, YM: 5,
  M2K: 5, RTY: 50,
  MGC: 10, GC: 100,
  MCL: 100, CL: 1000,
};

export function getContractMultiplier(symbol: string): number {
  const s = (symbol || "").toUpperCase().trim();
  const keys = Object.keys(CONTRACT_MULTIPLIERS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (s.startsWith(k)) return CONTRACT_MULTIPLIERS[k];
  }
  return 1;
}

export function calculateAutoPnl(params: {
  instrument_type: InstrumentType
  symbol: string
  direction: Direction
  entry_price: number
  exit_price: number
  position_size: number
}): number {
  const {instrument_type, symbol, direction, entry_price, exit_price, position_size} = params;
  if (!entry_price || !exit_price || !position_size) return 0;
  const diff = direction === "long" ? (exit_price - entry_price) : (entry_price - exit_price);

  if (instrument_type === "Futuros") {
    const mult = getContractMultiplier(symbol);
    return +(diff * mult * position_size).toFixed(2);
  }
  if (instrument_type === "Forex") {
    return +(diff * position_size * 100000).toFixed(2);
  }
  return +(diff * position_size).toFixed(2);
}

/* ==================== MÉTRICAS GENERALES ==================== */
export function computeMetrics(trades: Trade[], settings: UserSettings) {
  if (trades.length === 0) {
    return {netPnl: 0, grossPnl: 0, totalCommissions: 0, tradingDays: 0, profitFactor: 0,
      bestDay: null as any, worstDay: null as any, winRate: 0, wins: 0, losses: 0, breakevens: 0,
      equityCurve: [] as { date: string; equity: number }[], currentEquity: 0};
  }
  const sorted = [...trades].sort((a, b) => new Date(a.exit_datetime).getTime() - new Date(b.exit_datetime).getTime());
  const byDay: Record<string, number> = {};
  let grossPnl = 0; let totalCommissions = 0; let wins = 0; let losses = 0; let breakevens = 0; let grossWin = 0; let grossLoss = 0;
  for (const t of sorted) {
    const net = getNetPnl(t, settings);
    const day = t.exit_datetime.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + net;
    grossPnl += t.pnl;
    totalCommissions += getTradeCommission(t, settings);
    const cls = classifyTrade(t, settings);
    if (cls === "win") {
      wins++; grossWin += net;
    } else if (cls === "loss") {
      losses++; grossLoss += Math.abs(net);
    } else breakevens++;
  }
  const days = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0]));
  let equity = 0;
  const equityCurve = days.map(([date, pnl]) => {
    equity += pnl; return {date, equity};
  });
  const bestDayEntry = days.reduce((best, cur) => (cur[1] > (best?.[1] ?? -Infinity) ? cur : best), null as [string, number] | null);
  const worstDayEntry = days.reduce((worst, cur) => (cur[1] < (worst?.[1] ?? Infinity) ? cur : worst), null as [string, number] | null);
  return {
    netPnl: grossPnl - totalCommissions, grossPnl, totalCommissions, tradingDays: days.length,
    profitFactor: grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : grossWin > 0 ? Infinity : 0,
    bestDay: bestDayEntry ? {date: bestDayEntry[0], pnl: bestDayEntry[1]} : null,
    worstDay: worstDayEntry ? {date: worstDayEntry[0], pnl: worstDayEntry[1]} : null,
    winRate: wins + losses > 0 ? +((wins / (wins + losses)) * 100).toFixed(1) : 0,
    wins, losses, breakevens, equityCurve, currentEquity: equity,
  };
}

/* ==================== PERFORMANCE SCORE ==================== */
/**
 * Score 0-100. Pesos que suman 100:
 *  - Win rate: 40 pts (100% de WR = 40)
 *  - Profit factor: 40 pts (PF >= 3 o infinito = 40)
 *  - Consistencia: 20 pts (20+ días operados = 20)
 */
export const PERFORMANCE_SCORE_WEIGHTS = {winRate: 40, profitFactor: 40, consistency: 20} as const;

export function computePerformanceScore(m: ReturnType<typeof computeMetrics>) {
  const w = PERFORMANCE_SCORE_WEIGHTS;
  const wrScore = (Math.min(Math.max(m.winRate, 0), 100) / 100) * w.winRate;
  const pf = m.profitFactor === Infinity ? 3 : m.profitFactor;
  const pfScore = Math.min(Math.max(pf, 0) / 3, 1) * w.profitFactor;
  const consistencyScore = Math.min(m.tradingDays / 20, 1) * w.consistency;
  const total = wrScore + pfScore + consistencyScore;
  return Math.round(Math.min(100, Math.max(0, total)));
}

/**
 * Version "gemela" de computePerformanceScore que, ademas del total, expone
 * el desglose de los 3 componentes que lo forman. NO SE USA en el calculo
 * oficial que alimenta el Panel Nova ni el job diario (esos siguen llamando
 * a computePerformanceScore sin cambios) -- esta funcion es solo para el
 * widget visual de desglose en Analytics. Misma formula, mismos pesos.
 */
export interface PerformanceScoreBreakdown {
  total: number
  winRateScore: number
  winRateMax: number
  profitFactorScore: number
  profitFactorMax: number
  consistencyScore: number
  consistencyMax: number
}

export function computePerformanceScoreBreakdown(m: ReturnType<typeof computeMetrics>): PerformanceScoreBreakdown {
  const w = PERFORMANCE_SCORE_WEIGHTS;
  const wrScore = (Math.min(Math.max(m.winRate, 0), 100) / 100) * w.winRate;
  const pf = m.profitFactor === Infinity ? 3 : m.profitFactor;
  const pfScore = Math.min(Math.max(pf, 0) / 3, 1) * w.profitFactor;
  const consistencyScore = Math.min(m.tradingDays / 20, 1) * w.consistency;
  const total = Math.round(Math.min(100, Math.max(0, wrScore + pfScore + consistencyScore)));
  return {
    total,
    winRateScore: +wrScore.toFixed(1),
    winRateMax: w.winRate,
    profitFactorScore: +pfScore.toFixed(1),
    profitFactorMax: w.profitFactor,
    consistencyScore: +consistencyScore.toFixed(1),
    consistencyMax: w.consistency,
  };
}

export function computeExpectancy(trades: Trade[], settings: UserSettings) {
  if (trades.length === 0) return 0;
  const total = trades.reduce((acc, t) => acc + getNetPnl(t, settings), 0);
  return +(total / trades.length).toFixed(2);
}
export function computeAvgWinLoss(trades: Trade[], settings: UserSettings) {
  const wins = trades.filter((t) => classifyTrade(t, settings) === "win").map((t) => getNetPnl(t, settings));
  const losses = trades.filter((t) => classifyTrade(t, settings) === "loss").map((t) => getNetPnl(t, settings));
  const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
  return {avgWin: +avgWin.toFixed(2), avgLoss: +avgLoss.toFixed(2)};
}
export function computeMaxDrawdown(equityCurve: { date: string; equity: number }[]) {
  let peak = -Infinity; let maxDD = 0;
  for (const p of equityCurve) {
    peak = Math.max(peak, p.equity); maxDD = Math.min(maxDD, p.equity - peak);
  }
  return maxDD;
}

/* ==================== DESVIACIÓN ESTÁNDAR + SHARPE RATIO ==================== */
/**
 * Calcula la volatilidad del P&L diario (desviación estándar muestral)
 * y el Sharpe Ratio anualizado (asumiendo 252 días de trading/año).
 * Se basa en los incrementos día a día de la equity curve (P&L diario en $),
 * consistente con el resto de métricas de riesgo de la app (en $, no en %).
 */
export interface StdDevSharpeResult {
  stdDev: number
  sharpe: number
}

export function computeStdDevSharpe(equityCurve: { date: string; equity: number }[]): StdDevSharpeResult {
  if (equityCurve.length < 2) return { stdDev: 0, sharpe: 0 };
  const dailyPnls: number[] = [];
  let prev = 0;
  for (const p of equityCurve) {
    dailyPnls.push(p.equity - prev);
    prev = p.equity;
  }
  const n = dailyPnls.length;
  const mean = dailyPnls.reduce((a, b) => a + b, 0) / n;
  const variance = dailyPnls.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1 > 0 ? n - 1 : 1);
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev > 0 ? +((mean / stdDev) * Math.sqrt(252)).toFixed(2) : 0;
  return { stdDev: +stdDev.toFixed(2), sharpe };
}

/* ==================== RACHAS (STREAKS) DE TRADES GANADORES/PERDEDORES ==================== */
export interface StreakResult {
  currentStreak: number // siempre positivo; usar currentStreakType para saber si es de wins o losses
  currentStreakType: "win" | "loss" | "none"
  longestWinStreak: number
  longestLossStreak: number
}

export function computeStreaks(trades: Trade[], settings: UserSettings): StreakResult {
  if (trades.length === 0) {
    return { currentStreak: 0, currentStreakType: "none", longestWinStreak: 0, longestLossStreak: 0 };
  }
  const sorted = [...trades].sort((a, b) => new Date(a.exit_datetime).getTime() - new Date(b.exit_datetime).getTime());
  let longestWin = 0, longestLoss = 0, curWin = 0, curLoss = 0;
  for (const t of sorted) {
    const cls = classifyTrade(t, settings);
    if (cls === "win") {
      curWin++; curLoss = 0; longestWin = Math.max(longestWin, curWin);
    } else if (cls === "loss") {
      curLoss++; curWin = 0; longestLoss = Math.max(longestLoss, curLoss);
    } else {
      curWin = 0; curLoss = 0; // breakeven corta ambas rachas
    }
  }
  let currentStreak = 0;
  let currentStreakType: "win" | "loss" | "none" = "none";
  if (curWin > 0) { currentStreak = curWin; currentStreakType = "win"; }
  else if (curLoss > 0) { currentStreak = curLoss; currentStreakType = "loss"; }
  return { currentStreak, currentStreakType, longestWinStreak: longestWin, longestLossStreak: longestLoss };
}

/* ==================== FILTROS (Estrategia / Instrumento / Cuenta) ==================== */
export function filterTrades(trades: Trade[], opts: { strategyId?: string | "all"; instrumentType?: InstrumentType | "all"; accountId?: string | "all" }) {
  return trades.filter((t) => {
    if (opts.strategyId && opts.strategyId !== "all" && t.strategy_id !== opts.strategyId) return false;
    if (opts.instrumentType && opts.instrumentType !== "all" && t.instrument_type !== opts.instrumentType) return false;
    if (opts.accountId && opts.accountId !== "all" && t.account_id !== opts.accountId) return false;
    return true;
  });
}

/* ==================== HORA Y DÍA LOCAL (Europe/Madrid) ====================
 * Si entry_datetime NO lleva zona (ej. "2026-09-25T10:30"), se usa tal cual.
 * Si lleva zona (Z o +02:00), se convierte a Europe/Madrid.
 * Así la Cloud Function (que corre en UTC) da el mismo resultado que el navegador. */
const NOVA_TZ = "Europe/Madrid";
const HAS_TZ = /(Z|[+-]\d{2}:?\d{2})$/;
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export function getLocalHourAndDay(datetime: string): {hour: number; day: number} {
  const d = new Date(datetime);
  if (!HAS_TZ.test(datetime)) {
    return {hour: d.getHours(), day: d.getDay()};
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NOVA_TZ,
    hourCycle: "h23",
    hour: "numeric",
    weekday: "short",
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  return {hour, day: WEEKDAY_INDEX[weekday] ?? 0};
}

/* ==================== SESIONES (ÚNICA DEFINICIÓN) ====================
 * Hora de Madrid. Usada por el panel Y por Nova. */
export const SESSIONS = [
  {label: "Asia (00-08h)", from: 0, to: 8},
  {label: "Londres (08-13h)", from: 8, to: 13},
  {label: "Solapamiento NY-Londres (13-17h)", from: 13, to: 17},
  {label: "Nueva York (17-22h)", from: 17, to: 22},
] as const;
export const OUT_OF_SESSION_LABEL = "Fuera de sesión (22-00h)";

export function getSession(hour: number): string {
  const s = SESSIONS.find((x) => hour >= x.from && hour < x.to);
  return s ? s.label : OUT_OF_SESSION_LABEL;
}

/* ==================== PERFORMANCE POR HORA ==================== */
export function computeByHour(trades: Trade[], settings: UserSettings) {
  const buckets: Record<number, { pnl: number; wins: number; losses: number; count: number }> = {};
  for (let h = 0; h < 24; h++) buckets[h] = {pnl: 0, wins: 0, losses: 0, count: 0};
  for (const t of trades) {
    const hour = getLocalHourAndDay(t.entry_datetime).hour;
    const net = getNetPnl(t, settings);
    buckets[hour].pnl += net;
    buckets[hour].count += 1;
    if (net > settings.breakeven_threshold) buckets[hour].wins += 1;
    else if (net < -settings.breakeven_threshold) buckets[hour].losses += 1;
  }
  return Object.entries(buckets)
    .map(([h, d]) => ({hour: Number(h), ...d, winRate: d.count ? Math.round((d.wins / d.count) * 100) : 0}))
    .filter((b) => b.count > 0)
    .sort((a, b) => a.hour - b.hour);
}

/* ==================== PERFORMANCE POR DÍA DE LA SEMANA ==================== */
const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export function computeByWeekday(trades: Trade[], settings: UserSettings) {
  const buckets: Record<number, { pnl: number; wins: number; losses: number; count: number }> = {};
  for (let d = 0; d < 7; d++) buckets[d] = {pnl: 0, wins: 0, losses: 0, count: 0};
  for (const t of trades) {
    const day = getLocalHourAndDay(t.entry_datetime).day;
    const net = getNetPnl(t, settings);
    buckets[day].pnl += net;
    buckets[day].count += 1;
    if (net > settings.breakeven_threshold) buckets[day].wins += 1;
    else if (net < -settings.breakeven_threshold) buckets[day].losses += 1;
  }
  return Object.entries(buckets).map(([d, data]) => ({
    day: Number(d), label: WEEKDAY_LABELS[Number(d)], ...data,
    winRate: data.count ? Math.round((data.wins / data.count) * 100) : 0,
  }));
}

/* ==================== PERFORMANCE POR SESIÓN ==================== */
export function computeBySession(trades: Trade[], settings: UserSettings) {
  const order = [...SESSIONS.map((s) => s.label as string), OUT_OF_SESSION_LABEL];
  const sessions: Record<string, { pnl: number; count: number; wins: number }> = {};
  order.forEach((label) => {
    sessions[label] = {pnl: 0, count: 0, wins: 0};
  });
  for (const t of trades) {
    const key = getSession(getLocalHourAndDay(t.entry_datetime).hour);
    const net = getNetPnl(t, settings);
    sessions[key].pnl += net;
    sessions[key].count += 1;
    if (net > settings.breakeven_threshold) sessions[key].wins += 1;
  }
  return order
    .filter((name) => name !== OUT_OF_SESSION_LABEL || sessions[name].count > 0)
    .map((name) => {
      const d = sessions[name];
      return {name, ...d, winRate: d.count ? Math.round((d.wins / d.count) * 100) : 0};
    });
}

/* ==================== DISTRIBUCIÓN R-MULTIPLE ==================== */
export function computeRMultipleDistribution(trades: Trade[], settings: UserSettings) {
  const buckets = [
    {label: "< -2R", min: -Infinity, max: -2, count: 0},
    {label: "-2 a -1R", min: -2, max: -1, count: 0},
    {label: "-1 a 0R", min: -1, max: 0, count: 0},
    {label: "0 a 1R", min: 0, max: 1, count: 0},
    {label: "1 a 2R", min: 1, max: 2, count: 0},
    {label: "> 2R", min: 2, max: Infinity, count: 0},
  ];
  let skipped = 0;
  for (const t of trades) {
    if (!t.risk_amount || t.risk_amount === 0) {
      skipped++; continue;
    }
    const net = getNetPnl(t, settings);
    const r = net / t.risk_amount;
    const bucket = buckets.find((b) => r >= b.min && r < b.max);
    if (bucket) bucket.count += 1;
    else if (r >= 2) buckets[buckets.length - 1].count += 1;
  }
  return {buckets, skipped};
}

/* ==================== NIVELES DE CONFIANZA (ÚNICA DEFINICIÓN) ====================
 * 0 Sin datos (<5) · 1 Exploratoria (5-19) · 2 Emergente (20-49) · 3 Consolidada (>=50) */
export type ConfidenceLevel = 0 | 1 | 2 | 3

export const CONFIDENCE_THRESHOLDS = {exploratory: 5, emerging: 20, consolidated: 50} as const;

export function getConfidenceLevel(sampleSize: number): ConfidenceLevel {
  if (sampleSize >= CONFIDENCE_THRESHOLDS.consolidated) return 3;
  if (sampleSize >= CONFIDENCE_THRESHOLDS.emerging) return 2;
  if (sampleSize >= CONFIDENCE_THRESHOLDS.exploratory) return 1;
  return 0;
}

export type ConfidenceColor = "gray" | "yellow" | "blue" | "green"

export function getConfidenceLabel(level: ConfidenceLevel): {
  label: string
  description: string
  color: ConfidenceColor
} {
  switch (level) {
  case 0: return {
    label: "Sin datos",
    description: "Aún no hay suficientes operaciones para detectar patrones.",
    color: "gray",
  };
  case 1: return {
    label: "Exploratoria",
    description: "Patrón inicial — basado en pocas operaciones. Tómalo como orientación.",
    color: "yellow",
  };
  case 2: return {
    label: "Emergente",
    description: "Patrón emergente — ganando consistencia.",
    color: "blue",
  };
  case 3: return {
    label: "Consolidada",
    description: "Patrón consolidado — muestra suficiente para confiar en esta tendencia.",
    color: "green",
  };
  }
}

/* ==================== BLOQUE 4: CORRELACIONES (EL MOAT) ==================== */
export interface CorrelationGroup {
  label: string
  sampleSize: number
  winRate: number
  avgPnl: number
  confidenceLevel: ConfidenceLevel // nivel propio del grupo
}

export interface CorrelationResult {
  dimension: string
  groups: CorrelationGroup[]
  delta: number // 0 si la dimensión no compara dos grupos
  deltaConfidence: ConfidenceLevel // nivel del grupo más débil de la comparación; 0 si no hay delta
}

function extractDateOnly(datetime: string): string {
  return datetime.split("T")[0];
}

// Settings para clasificar trades en las correlaciones (misma regla que el panel)
let _corrSettings: UserSettings | null = null;
export function setCorrelationSettings(s: UserSettings) {
  _corrSettings = s;
}

function netOf(t: Trade): number {
  return _corrSettings ? getNetPnl(t, _corrSettings) : t.pnl;
}

function classOf(t: Trade): "win" | "loss" | "be" {
  if (_corrSettings) return classifyTrade(t, _corrSettings);
  return t.pnl > 0 ? "win" : t.pnl < 0 ? "loss" : "be";
}

function makeGroup(label: string, sampleSize: number, winRate: number, avgPnl: number): CorrelationGroup {
  return {label, sampleSize, winRate, avgPnl, confidenceLevel: getConfidenceLevel(sampleSize)};
}

function calcGroupStats(trades: Trade[], label: string): CorrelationGroup {
  const wins = trades.filter((t) => classOf(t) === "win").length;
  const losses = trades.filter((t) => classOf(t) === "loss").length;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 1000) / 10 : 0;
  const avgPnl = trades.length > 0 ? trades.reduce((s, t) => s + netOf(t), 0) / trades.length : 0;
  return makeGroup(label, trades.length, winRate, Math.round(avgPnl * 100) / 100);
}

function minConfidence(...groups: CorrelationGroup[]): ConfidenceLevel {
  if (groups.length === 0) return 0;
  return Math.min(...groups.map((g) => g.confidenceLevel)) as ConfidenceLevel;
}

function noDelta(dimension: string, groups: CorrelationGroup[]): CorrelationResult {
  return {dimension, groups, delta: 0, deltaConfidence: 0};
}

export function correlateRuleToPerformance(
  trades: Trade[], habitLogs: HabitLog[], ruleId: string
): CorrelationResult {
  const daysFollowed = new Set(habitLogs.filter((h) => h.rule_id === ruleId && h.checked).map((h) => h.date));
  const daysNotFollowed = new Set(habitLogs.filter((h) => h.rule_id === ruleId && !h.checked).map((h) => h.date));

  const tFollowed = trades.filter((t) => daysFollowed.has(extractDateOnly(t.entry_datetime)));
  const tNotFollowed = trades.filter((t) => daysNotFollowed.has(extractDateOnly(t.entry_datetime)));

  const gF = calcGroupStats(tFollowed, "Regla cumplida");
  const gNF = calcGroupStats(tNotFollowed, "Regla incumplida");
  const delta = Math.round((gF.winRate - gNF.winRate) * 10) / 10;

  return {
    dimension: `Regla: ${ruleId}`, groups: [gF, gNF], delta,
    deltaConfidence: minConfidence(gF, gNF),
  };
}

export function correlateAllRules(
  trades: Trade[], habitLogs: HabitLog[], habitRules: HabitRule[]
): CorrelationResult[] {
  return habitRules.map((rule) => {
    const result = correlateRuleToPerformance(trades, habitLogs, rule.id);
    return {...result, dimension: `Regla: ${rule.text}`};
  });
}

export function correlateBiasAccuracy(biasEntries: DailyBiasEntry[]): CorrelationResult {
  const withOutcome = biasEntries.filter((b) => b.outcome);
  const groups = (["Acertado", "Fallado"] as const).map((outcome) => {
    const subset = withOutcome.filter((b) => b.outcome === outcome);
    return makeGroup(outcome, subset.length, 0, 0);
  });
  return noDelta("Bias Diario: precisión de expectativa", groups);
}

export function correlateFollowedPlan(
  trades: Trade[], mindsetEntries: MindsetEntry[]
): CorrelationResult {
  const dateToStatus = new Map(mindsetEntries.filter((m) => m.followed_plan).map((m) => [m.date, m.followed_plan]));
  const statuses = ["yes", "partial", "no"] as const;
  const groups = statuses.map((status) => {
    const dates = new Set([...dateToStatus.entries()].filter(([_, s]) => s === status).map(([d]) => d));
    const subset = trades.filter((t) => dates.has(extractDateOnly(t.entry_datetime)));
    return calcGroupStats(subset, status);
  });
  const yesG = groups.find((g) => g.label === "yes")!;
  const noG = groups.find((g) => g.label === "no")!;
  const delta = Math.round((yesG.winRate - noG.winRate) * 10) / 10;

  return {
    dimension: "Mindset: ¿Respetaste tu plan del premarket?",
    groups, delta, deltaConfidence: minConfidence(yesG, noG),
  };
}

export function correlateEmotionToPerformance(
  trades: Trade[], mindsetEntries: MindsetEntry[]
): CorrelationResult {
  const emotionDates = new Map<string, string>();
  mindsetEntries.forEach((m) => {
    if (m.dominant_emotion) emotionDates.set(m.date, m.dominant_emotion);
  });

  const emotionGroups = new Map<string, Trade[]>();
  trades.forEach((t) => {
    const date = extractDateOnly(t.entry_datetime);
    const emotion = emotionDates.get(date);
    if (emotion) {
      if (!emotionGroups.has(emotion)) emotionGroups.set(emotion, []);
      emotionGroups.get(emotion)!.push(t);
    }
  });

  const groups = [...emotionGroups.entries()].map(([emotion, ts]) => calcGroupStats(ts, emotion));
  return noDelta("Emoción dominante ↔ Rendimiento", groups);
}

export function correlateSleepToPerformance(
  trades: Trade[], mindsetEntries: MindsetEntry[]
): CorrelationResult {
  const slept = new Set(mindsetEntries.filter((m) => m.slept_well === true).map((m) => m.date));
  const notSlept = new Set(mindsetEntries.filter((m) => m.slept_well === false).map((m) => m.date));

  const tSlept = trades.filter((t) => slept.has(extractDateOnly(t.entry_datetime)));
  const tNotSlept = trades.filter((t) => notSlept.has(extractDateOnly(t.entry_datetime)));

  const gSlept = calcGroupStats(tSlept, "Durmió +7h");
  const gNotSlept = calcGroupStats(tNotSlept, "No durmió bien");
  const delta = Math.round((gSlept.winRate - gNotSlept.winRate) * 10) / 10;

  return {
    dimension: "Sueño ↔ Rendimiento",
    groups: [gSlept, gNotSlept], delta,
    deltaConfidence: minConfidence(gSlept, gNotSlept),
  };
}

export function correlateEmotionalBaggage(
  trades: Trade[], mindsetEntries: MindsetEntry[]
): CorrelationResult {
  const withBaggage = new Set(mindsetEntries.filter((m) => m.emotional_baggage === true).map((m) => m.date));
  const withoutBaggage = new Set(mindsetEntries.filter((m) => m.emotional_baggage === false).map((m) => m.date));

  const tWith = trades.filter((t) => withBaggage.has(extractDateOnly(t.entry_datetime)));
  const tWithout = trades.filter((t) => withoutBaggage.has(extractDateOnly(t.entry_datetime)));

  const gWith = calcGroupStats(tWith, "Con carga emocional");
  const gWithout = calcGroupStats(tWithout, "Sin carga emocional");
  const delta = Math.round((gWith.winRate - gWithout.winRate) * 10) / 10;

  return {
    dimension: "Carga emocional arrastrada ↔ Rendimiento",
    groups: [gWith, gWithout], delta,
    deltaConfidence: minConfidence(gWith, gWithout),
  };
}

export function correlateRevengeTradingFlags(
  trades: Trade[], mindsetEntries: MindsetEntry[]
): CorrelationResult {
  const flaggedDates = new Set(
    mindsetEntries.filter((m) => m.needed_to_recover === true || m.wrong_decision === true).map((m) => m.date)
  );
  const cleanDates = new Set(
    mindsetEntries.filter((m) => m.needed_to_recover === false && m.wrong_decision === false).map((m) => m.date)
  );

  const tFlagged = trades.filter((t) => flaggedDates.has(extractDateOnly(t.entry_datetime)));
  const tClean = trades.filter((t) => cleanDates.has(extractDateOnly(t.entry_datetime)));

  const gFlagged = calcGroupStats(tFlagged, "Día con bandera roja");
  const gClean = calcGroupStats(tClean, "Día limpio");
  const delta = Math.round((gClean.winRate - gFlagged.winRate) * 10) / 10;

  return {
    dimension: "Días con bandera roja (revenge/decisión incorrecta) ↔ Rendimiento",
    groups: [gFlagged, gClean], delta,
    deltaConfidence: minConfidence(gFlagged, gClean),
  };
}

export function correlateStrategyPerformance(
  trades: Trade[], strategies: Strategy[]
): CorrelationResult {
  const groups = strategies.map((s) => {
    const subset = trades.filter((t) => t.strategy_id === s.id);
    return calcGroupStats(subset, s.name);
  });
  const noStrategy = trades.filter((t) => !t.strategy_id);
  if (noStrategy.length > 0) groups.push(calcGroupStats(noStrategy, "Sin etiquetar"));

  return noDelta("Estrategias ↔ Rendimiento", groups);
}

export function correlateChecklistUsage(
  trades: Trade[], checklists: Checklist[]
): CorrelationResult {
  void checklists;
  const withChecklist = trades.filter((t) => t.checklist_id);
  const withoutChecklist = trades.filter((t) => !t.checklist_id);

  const gWith = calcGroupStats(withChecklist, "Con checklist");
  const gWithout = calcGroupStats(withoutChecklist, "Sin checklist");
  const delta = Math.round((gWith.winRate - gWithout.winRate) * 10) / 10;

  return {
    dimension: "Uso de Checklist ↔ Rendimiento",
    groups: [gWith, gWithout], delta,
    deltaConfidence: minConfidence(gWith, gWithout),
  };
}

export function correlateRatingToPerformance(trades: Trade[]): CorrelationResult {
  const withRating = trades.filter((t) => t.rating !== undefined && t.rating !== null);
  const highRating = withRating.filter((t) => (t.rating as number) >= 7);
  const lowRating = withRating.filter((t) => (t.rating as number) < 7);

  const gHigh = calcGroupStats(highRating, "Rating alto (7-10)");
  const gLow = calcGroupStats(lowRating, "Rating bajo (1-6)");
  const delta = Math.round((gHigh.winRate - gLow.winRate) * 10) / 10;

  return {
    dimension: "Rating de confianza ↔ Rendimiento",
    groups: [gHigh, gLow], delta,
    deltaConfidence: minConfidence(gHigh, gLow),
  };
}

export function correlateDayOfWeek(trades: Trade[]): CorrelationResult {
  const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const groups = dayNames.map((name, idx) => {
    const subset = trades.filter((t) => getLocalHourAndDay(t.entry_datetime).day === idx);
    return calcGroupStats(subset, name);
  }).filter((g) => g.sampleSize > 0);

  return noDelta("Día de la semana ↔ Rendimiento", groups);
}

export function correlateSessionPerformance(trades: Trade[]): CorrelationResult {
  const sessionGroups = new Map<string, Trade[]>();
  trades.forEach((t) => {
    const session = getSession(getLocalHourAndDay(t.entry_datetime).hour);
    if (!sessionGroups.has(session)) sessionGroups.set(session, []);
    sessionGroups.get(session)!.push(t);
  });

  const groups = [...sessionGroups.entries()].map(([session, ts]) => calcGroupStats(ts, session));
  return noDelta("Sesión horaria ↔ Rendimiento", groups);
}

export function correlateInstrumentPerformance(trades: Trade[]): CorrelationResult {
  const symbolGroups = new Map<string, Trade[]>();
  trades.forEach((t) => {
    if (!symbolGroups.has(t.symbol)) symbolGroups.set(t.symbol, []);
    symbolGroups.get(t.symbol)!.push(t);
  });

  const groups = [...symbolGroups.entries()]
    .map(([symbol, ts]) => calcGroupStats(ts, symbol))
    .sort((a, b) => b.sampleSize - a.sampleSize);

  return noDelta("Instrumento/Símbolo ↔ Rendimiento", groups);
}

export function correlateDirectionPerformance(trades: Trade[]): CorrelationResult {
  const longs = trades.filter((t) => t.direction === "long");
  const shorts = trades.filter((t) => t.direction === "short");

  const gLong = calcGroupStats(longs, "Long");
  const gShort = calcGroupStats(shorts, "Short");
  const delta = Math.round((gLong.winRate - gShort.winRate) * 10) / 10;

  return {
    dimension: "Dirección (Long/Short) ↔ Rendimiento",
    groups: [gLong, gShort], delta,
    deltaConfidence: minConfidence(gLong, gShort),
  };
}

/* ==================== SCORE DE DISCIPLINA DIARIO ==================== */

/**
 * REGLA DE DISCIPLINA:
 *   base (followed_plan): yes = 100 · partial = 50 · no = 0
 *   agravantes: needed_to_recover y wrong_decision, -20 por cada uno marcado
 *   arrastre: -10 si ayer estuvo rota, -4 si anteayer (solo días consecutivos)
 *   finalScore = base - agravantes - arrastre, limitado a 0-100
 */
export const DISCIPLINE_AGGRAVANT_PENALTY = 20;

export interface DailyDisciplineResult {
  date: string
  hasData: boolean // ¿hay post-sesión con followed_plan registrado ese día?
  baseScore: number | null // 100 / 50 / 0 según followed_plan (yes/partial/no)
  disciplineBroken: boolean // agravante: needed_to_recover || wrong_decision → Sí
  aggravantCount: number // 0, 1 o 2 agravantes marcados ese día
  aggravantPenalty: number // aggravantCount * DISCIPLINE_AGGRAVANT_PENALTY
  carryOverPenalty: number // arrastre transparente heredado de días anteriores
  finalScore: number | null // baseScore - aggravantPenalty - carryOverPenalty (0-100)
  brokenStreakLength: number // racha de días consecutivos con disciplina rota, terminando hoy
  streakAlert: boolean // true si la racha alcanza el umbral de alerta distinta
}

const CARRY_OVER_DECAY = [10, 4]; // penalización si el día -1 estuvo roto, si el día -2 estuvo roto
const STREAK_ALERT_THRESHOLD = 3; // 3+ días seguidos rotos → alerta distinta, no solo decaimiento

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + "T00:00:00").getTime();
  const b = new Date(dateB + "T00:00:00").getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * Calcula el Score de Disciplina para cada día con post-sesión registrada.
 * Núcleo: ¿respetaste el plan? Agravantes: recuperar / decisión sabida incorrecta.
 * Si hay agravante → "disciplina rota" ese día (se reporta como flag, no se diluye
 * en el promedio general). El arrastre a días siguientes es leve y se desvanece rápido,
 * salvo racha de varios días, que dispara una alerta distinta.
 */
export function calculateDisciplineScores(mindsetEntries: MindsetEntry[]): DailyDisciplineResult[] {
  const sorted = mindsetEntries
    .filter((m) => m.has_postsession)
    .sort((a, b) => a.date.localeCompare(b.date));

  const results: DailyDisciplineResult[] = [];
  let currentStreak = 0;

  for (const entry of sorted) {
    const hasData = !!entry.followed_plan;
    const baseScore = !hasData ? null :
      entry.followed_plan === "yes" ? 100 :
        entry.followed_plan === "partial" ? 50 :
          0;

    const aggravantCount =
      (entry.needed_to_recover === true ? 1 : 0) + (entry.wrong_decision === true ? 1 : 0);
    const aggravantPenalty = aggravantCount * DISCIPLINE_AGGRAVANT_PENALTY;
    const disciplineBroken = aggravantCount > 0;
    currentStreak = disciplineBroken ? currentStreak + 1 : 0;

    // Arrastre: solo cuenta si el día anterior en el calendario (no solo el anterior en la lista)
    // estuvo efectivamente roto. Si hay un hueco de días sin registrar, no se arrastra.
    let carryOverPenalty = 0;
    CARRY_OVER_DECAY.forEach((penalty, idx) => {
      const lag = idx + 1;
      const prev = results[results.length - lag];
      if (prev && daysBetween(prev.date, entry.date) === lag && prev.disciplineBroken) {
        carryOverPenalty += penalty;
      }
    });

    const finalScore = baseScore === null ?
      null :
      Math.max(0, Math.min(100, baseScore - aggravantPenalty - carryOverPenalty));

    results.push({
      date: entry.date,
      hasData,
      baseScore,
      disciplineBroken,
      aggravantCount,
      aggravantPenalty,
      carryOverPenalty,
      finalScore,
      brokenStreakLength: currentStreak,
      streakAlert: currentStreak >= STREAK_ALERT_THRESHOLD,
    });
  }

  return results;
}

/**
 * Resumen de un período (ej. semana). Reporta el promedio Y el conteo de días
 * con disciplina rota por separado, tal como pide la spec ("no se diluye en promedio").
 */
export interface DisciplinePeriodSummary {
  totalDays: number
  daysWithData: number
  avgScore: number | null
  brokenDaysCount: number
  streakAlertActive: boolean
}

export function summarizeDisciplinePeriod(
  results: DailyDisciplineResult[],
  fromDate?: string,
  toDate?: string
): DisciplinePeriodSummary {
  const inRange = results.filter((r) =>
    (!fromDate || r.date >= fromDate) && (!toDate || r.date <= toDate)
  );
  const withScore = inRange.filter((r) => r.finalScore !== null);
  const avgScore = withScore.length ?
    Math.round((withScore.reduce((s, r) => s + (r.finalScore ?? 0), 0) / withScore.length)) :
    null;

  return {
    totalDays: inRange.length,
    daysWithData: withScore.length,
    avgScore,
    brokenDaysCount: inRange.filter((r) => r.disciplineBroken).length,
    streakAlertActive: inRange.some((r) => r.streakAlert),
  };
}

/**
 * Correlación: días con disciplina rota vs días limpios, respecto al P&L diario (neto).
 * OJO: aquí sampleSize cuenta DÍAS, no trades.
 */
export function correlateDisciplineBrokenToPnl(
  mindsetEntries: MindsetEntry[],
  trades: Trade[]
): CorrelationResult {
  const scores = calculateDisciplineScores(mindsetEntries);

  const pnlByDate = new Map<string, number>();
  trades.forEach((t) => {
    const d = extractDateOnly(t.entry_datetime);
    pnlByDate.set(d, (pnlByDate.get(d) || 0) + netOf(t));
  });

  const brokenDays = scores.filter((s) => s.disciplineBroken && pnlByDate.has(s.date));
  const cleanDays = scores.filter((s) => s.hasData && !s.disciplineBroken && pnlByDate.has(s.date));

  const toGroup = (days: DailyDisciplineResult[], label: string): CorrelationGroup => {
    const pnls = days.map((d) => pnlByDate.get(d.date)!);
    const wins = pnls.filter((p) => p > 0).length;
    return makeGroup(
      label,
      days.length,
      days.length ? Math.round((wins / days.length) * 1000) / 10 : 0,
      days.length ? Math.round((pnls.reduce((a, b) => a + b, 0) / days.length) * 100) / 100 : 0
    );
  };

  const gBroken = toGroup(brokenDays, "Disciplina rota");
  const gClean = toGroup(cleanDays, "Día limpio");
  const delta = Math.round((gClean.avgPnl - gBroken.avgPnl) * 100) / 100;

  return {
    dimension: "Disciplina rota (agravantes) ↔ P&L diario",
    groups: [gBroken, gClean],
    delta,
    deltaConfidence: minConfidence(gBroken, gClean),
  };
}

/* ==================== ALERTA: DÍAS SIN REGISTRAR ==================== */
export interface RegistrationGapAlert {
  daysSinceLastEntry: number
  lastEntryDate: string | null
  shouldAlert: boolean
}

export function checkRegistrationGap(
  trades: Trade[],
  mindsetEntries: MindsetEntry[],
  dailyBias: DailyBiasEntry[]
): RegistrationGapAlert {
  const allDates = [
    ...trades.map((t) => extractDateOnly(t.entry_datetime)),
    ...mindsetEntries.map((m) => m.date),
    ...dailyBias.map((b) => b.date),
  ].sort().reverse();

  if (allDates.length === 0) {
    return {daysSinceLastEntry: 0, lastEntryDate: null, shouldAlert: false};
  }

  const lastEntryDate = allDates[0];
  const today = new Date();
  const last = new Date(lastEntryDate);
  const daysSinceLastEntry = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

  return {
    daysSinceLastEntry,
    lastEntryDate,
    shouldAlert: daysSinceLastEntry >= 3,
  };
}

/* ==================== DATASET DIARIO UNIFICADO (para preguntas libres/ad-hoc de Nova) ==================== */
export interface DailyRecord {
  date: string
  trades_count: number
  win_rate: number | null
  avg_pnl: number | null
  total_pnl: number | null
  long_count: number
  short_count: number
  bias: {
    market: string
    expected_direction: string
    outcome: string | null
  } | null
  mindset: {
    emotion_premarket: number | null
    slept_well: boolean | null
    emotional_baggage: boolean | null
    followed_plan: string | null
    dominant_emotion: string | null
    needed_to_recover: boolean | null
    wrong_decision: boolean | null
    close_emotion: number | null
  } | null
  habits_followed_pct: number | null
  checklist_usage_pct: number | null
}

export function buildDailyDataset(
  trades: Trade[],
  mindsetEntries: MindsetEntry[],
  dailyBias: DailyBiasEntry[],
  habitLogs: HabitLog[],
  habitRules: HabitRule[]
): DailyRecord[] {
  const allDates = new Set<string>([
    ...trades.map((t) => extractDateOnly(t.entry_datetime)),
    ...mindsetEntries.map((m) => m.date),
    ...dailyBias.map((b) => b.date),
    ...habitLogs.map((h) => h.date),
  ]);

  const records: DailyRecord[] = [...allDates].sort().reverse().map((date) => {
    const tradesThatDay = trades.filter((t) => extractDateOnly(t.entry_datetime) === date);
    const mindsetThatDay = mindsetEntries.find((m) => m.date === date);
    const biasThatDay = dailyBias.find((b) => b.date === date);
    const habitLogsThatDay = habitLogs.filter((h) => h.date === date);

    const wins = tradesThatDay.filter((t) => t.pnl > 0).length;
    const losses = tradesThatDay.filter((t) => t.pnl < 0).length;
    const win_rate = (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 1000) / 10 : null;
    const total_pnl = tradesThatDay.length > 0 ?
      tradesThatDay.reduce((s, t) => s + t.pnl, 0) :
      null;
    const avg_pnl = tradesThatDay.length > 0 ? Math.round((total_pnl! / tradesThatDay.length) * 100) / 100 : null;

    const habits_followed_pct = habitRules.length > 0 ?
      Math.round((habitLogsThatDay.filter((h) => h.checked).length / habitRules.length) * 1000) / 10 :
      null;

    const tradesWithChecklist = tradesThatDay.filter((t) => t.checklist_id).length;
    const checklist_usage_pct = tradesThatDay.length > 0 ?
      Math.round((tradesWithChecklist / tradesThatDay.length) * 1000) / 10 :
      null;

    return {
      date,
      trades_count: tradesThatDay.length,
      win_rate,
      avg_pnl,
      total_pnl,
      long_count: tradesThatDay.filter((t) => t.direction === "long").length,
      short_count: tradesThatDay.filter((t) => t.direction === "short").length,
      bias: biasThatDay ? {
        market: biasThatDay.market,
        expected_direction: biasThatDay.expected_direction,
        outcome: biasThatDay.outcome || null,
      } : null,
      mindset: mindsetThatDay ? {
        emotion_premarket: mindsetThatDay.emotion ?? null,
        slept_well: mindsetThatDay.slept_well ?? null,
        emotional_baggage: mindsetThatDay.emotional_baggage ?? null,
        followed_plan: mindsetThatDay.followed_plan || null,
        dominant_emotion: mindsetThatDay.dominant_emotion || null,
        needed_to_recover: mindsetThatDay.needed_to_recover ?? null,
        wrong_decision: mindsetThatDay.wrong_decision ?? null,
        close_emotion: mindsetThatDay.close_emotion ?? null,
      } : null,
      habits_followed_pct,
      checklist_usage_pct,
    };
  });

  return records;
}

/* ==================== COLOR DEL DÍA (MINDSET) ==================== */
export type DayMood = "green" | "yellow" | "red" | "none"

export function getMindsetDayColor(entry?: MindsetEntry): DayMood {
  if (!entry) return "none";
  let score = 0;
  let signals = 0;

  if (entry.conviction !== undefined) {
    signals++; score += entry.conviction ? 1 : -2;
  }
  if (entry.wrong_decision !== undefined) {
    signals++; score += entry.wrong_decision ? -1.5 : 1;
  }
  if (entry.followed_plan) {
    signals++;
    if (entry.followed_plan === "yes") score += 1.5;
    else if (entry.followed_plan === "partial") score += 0;
    else score -= 1.5;
  }
  if (entry.close_emotion !== undefined) {
    signals++;
    if (entry.close_emotion >= 7) score += 1;
    else if (entry.close_emotion <= 4) score -= 1;
  }
  if (entry.change_vs_start) {
    signals++;
    if (entry.change_vs_start === "mejor") score += 1;
    else if (entry.change_vs_start === "peor") score -= 1;
  }
  if (entry.needed_to_recover !== undefined) {
    signals++; score += entry.needed_to_recover ? -1 : 0.5;
  }

  if (signals === 0) return "none";
  const avg = score / signals;
  if (avg <= -0.5) return "red";
  if (avg >= 0.6) return "green";
  return "yellow";
}

/* ==================== CUENTAS ==================== */
export function computeAccountStats(account: TradingAccount, trades: Trade[], settings: UserSettings) {
  const accountTrades = trades.filter((t) => t.account_id === account.id);
  const netPnl = accountTrades.reduce((acc, t) => acc + getNetPnl(t, settings), 0);
  const balance = account.initial_balance + netPnl;
  const pnlPct = account.initial_balance > 0 ? +((netPnl / account.initial_balance) * 100).toFixed(2) : 0;

  let progressPct: number | null = null;
  if (account.category === "Prop Firm" && account.profit_target_pct && account.phase !== "Funded") {
    progressPct = Math.min(100, Math.max(0, +((pnlPct / account.profit_target_pct) * 100).toFixed(1)));
  }

  return {tradesCount: accountTrades.length, netPnl: +netPnl.toFixed(2), balance: +balance.toFixed(2), pnlPct, progressPct};
}

/* ==================== ESTADÍSTICAS DE FLUJOS DE CAPITAL ==================== */
export interface CapitalFlowStats {
  totalDeposits: number
  totalWithdrawals: number
  totalEvaluationFees: number
  totalResetFees: number
  totalPayouts: number
  netCapitalInvested: number
  netRealProfit: number
}

export function computeCapitalFlowStats(
  flows: { type: "deposit" | "withdrawal" | "evaluation_fee" | "reset_fee" | "payout"; amount: number }[]
): CapitalFlowStats {
  let totalDeposits = 0, totalWithdrawals = 0, totalEvaluationFees = 0, totalResetFees = 0, totalPayouts = 0;
  flows.forEach((f) => {
    if (f.type === "deposit") totalDeposits += f.amount;
    else if (f.type === "withdrawal") totalWithdrawals += f.amount;
    else if (f.type === "evaluation_fee") totalEvaluationFees += f.amount;
    else if (f.type === "reset_fee") totalResetFees += f.amount;
    else if (f.type === "payout") totalPayouts += f.amount;
  });
  return {
    totalDeposits: +totalDeposits.toFixed(2),
    totalWithdrawals: +totalWithdrawals.toFixed(2),
    totalEvaluationFees: +totalEvaluationFees.toFixed(2),
    totalResetFees: +totalResetFees.toFixed(2),
    totalPayouts: +totalPayouts.toFixed(2),
    netCapitalInvested: +(totalDeposits - totalWithdrawals).toFixed(2),
    netRealProfit: +(totalPayouts - totalEvaluationFees - totalResetFees).toFixed(2),
  };
}

export function getAccountGroupLabel(account: TradingAccount): string {
  if (account.category === "Capital Real") return `${account.instrument_type} · Capital Real`;
  return `${account.instrument_type} · ${account.phase || "Prop Firm"}`;
}

export function groupAccountsByPhase(accounts: TradingAccount[], trades: Trade[], settings: UserSettings) {
  const groups: Record<string, { label: string; instrument_type: InstrumentType; accounts: TradingAccount[]; initial: number; balance: number; netPnl: number }> = {};
  accounts.forEach((acc) => {
    const label = getAccountGroupLabel(acc);
    if (!groups[label]) groups[label] = {label, instrument_type: acc.instrument_type, accounts: [], initial: 0, balance: 0, netPnl: 0};
    const stats = computeAccountStats(acc, trades, settings);
    groups[label].accounts.push(acc);
    groups[label].initial += acc.initial_balance;
    groups[label].balance += stats.balance;
    groups[label].netPnl += stats.netPnl;
  });
  return Object.values(groups).sort((a, b) => a.label.localeCompare(b.label));
}

/* ==================== FILTRO DE GRUPO (Instrumento + Fase) — usado en Panel ==================== */
export interface AccountGroupFilter {
  instrument: InstrumentType | "Todas"
  phase: AccountPhase | "Capital Real" | "Todas"
}

export function getAccountIdsForGroupFilter(accounts: TradingAccount[], filter: AccountGroupFilter): string[] | null {
  if (filter.instrument === "Todas") return null;
  let matched = accounts.filter((a) => a.instrument_type === filter.instrument);
  if (filter.phase && filter.phase !== "Todas") {
    if (filter.phase === "Capital Real") {
      matched = matched.filter((a) => a.category === "Capital Real");
    } else {
      matched = matched.filter((a) => a.category === "Prop Firm" && a.phase === filter.phase);
    }
  }
  return matched.map((a) => a.id);
}

/* ==================== RACHA POST-PÉRDIDA ==================== */
export type PostLossStreakGroup = CorrelationGroup

export interface PostLossStreakResult extends CorrelationResult {
  streakLengthsTested: number[]
}

/**
 * Mide el rendimiento del trade inmediatamente DESPUÉS de una racha
 * de N pérdidas consecutivas.
 * Grupos: "Sin racha previa", "Tras 1 pérdida", "Tras 2 seguidas", "Tras 3+ seguidas".
 * Cada grupo lleva su propio confidenceLevel.
 */
export function correlatePostLossStreak(trades: Trade[]): PostLossStreakResult {
  const dimension = "Racha post-pérdida ↔ Rendimiento";
  const streakLengthsTested = [1, 2, 3];

  if (trades.length === 0) {
    return {dimension, groups: [], delta: 0, deltaConfidence: 0, streakLengthsTested};
  }

  // Ordenar por fecha de entrada
  const sorted = [...trades].sort(
    (a, b) => new Date(a.entry_datetime).getTime() - new Date(b.entry_datetime).getTime()
  );

  const buckets: Record<string, Trade[]> = {
    "Sin racha previa": [],
    "Tras 1 pérdida": [],
    "Tras 2 seguidas": [],
    "Tras 3+ seguidas": [],
  };

  // Para cada trade, cuántas pérdidas consecutivas había ANTES
  for (let i = 0; i < sorted.length; i++) {
    let streak = 0;
    for (let j = i - 1; j >= 0; j--) {
      if (classOf(sorted[j]) === "loss") streak++;
      else break;
    }
    if (streak === 0) buckets["Sin racha previa"].push(sorted[i]);
    else if (streak === 1) buckets["Tras 1 pérdida"].push(sorted[i]);
    else if (streak === 2) buckets["Tras 2 seguidas"].push(sorted[i]);
    else buckets["Tras 3+ seguidas"].push(sorted[i]);
  }

  const groups = Object.entries(buckets).map(([label, ts]) => calcGroupStats(ts, label));

  return {dimension, groups, delta: 0, deltaConfidence: 0, streakLengthsTested};
}
/* ==================== RANKINGS NOVA ====================
 * Una sola definición para el Panel Nova (navegador) y para el mensaje
 * diario (servidor). Los costes en $ = media por trade × nº de trades
 * (P&L neto) y no se pueden sumar entre tarjetas.
 */
export interface NovaRankGroupInput {
  label: string;
  sampleSize: number;
  winRate: number;
  avgPnl: number;
}

export interface NovaRankHourInput {
  hour: number;
  count: number;
  pnl: number;
  winRate?: number;
}

export interface NovaRankItem {
  key: string;
  label: string;
  tag?: string;
  sampleSize: number;
  winRate?: number;
  avgPnl: number;
  value: number;
  level: ConfidenceLevel;
}

export interface NovaRankings {
  worst: NovaRankItem[];
  best: NovaRankItem[];
  bestHours: NovaRankItem[];
  worstHours: NovaRankItem[];
}

const NOVA_RANK_SOURCES: {
  key: "dayOfWeek" | "session" | "strategy" | "emotion";
  tag: string;
}[] = [
  {key: "dayOfWeek", tag: "Día"},
  {key: "session", tag: "Sesión"},
  {key: "strategy", tag: "Estrategia"},
  {key: "emotion", tag: "Emoción"},
];

function novaRound2(n: number): number {
  return Math.round(n * 100) / 100;
}

function novaHourLabel(h: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:00–${p((h + 1) % 24)}:00`;
}

export function buildNovaRankings(
  groups: {
    dayOfWeek: NovaRankGroupInput[];
    session: NovaRankGroupInput[];
    strategy: NovaRankGroupInput[];
    emotion: NovaRankGroupInput[];
  },
  byHour: NovaRankHourInput[] | null,
  maxItems = 4,
  maxHours = 2
): NovaRankings {
  const items: NovaRankItem[] = [];
  for (const src of NOVA_RANK_SOURCES) {
    for (const g of groups[src.key]) {
      const level = getConfidenceLevel(g.sampleSize);
      if (level === 0) continue; // grupos sin datos suficientes, fuera
      if (
        src.key === "strategy" &&
        g.label.trim().toLowerCase().startsWith("sin etiquetar")
      ) {
        continue; // "Sin etiquetar" no es una estrategia
      }
      items.push({
        key: `${src.key}-${g.label}`,
        label: g.label,
        tag: src.tag,
        sampleSize: g.sampleSize,
        winRate: g.winRate,
        avgPnl: g.avgPnl,
        value: novaRound2(g.avgPnl * g.sampleSize),
        level,
      });
    }
  }

  const hourItems: NovaRankItem[] = [];
  for (const h of byHour ?? []) {
    const level = getConfidenceLevel(h.count);
    if (level === 0) continue;
    hourItems.push({
      key: `hour-${h.hour}`,
      label: novaHourLabel(h.hour),
      sampleSize: h.count,
      winRate: undefined,
      avgPnl: novaRound2(h.pnl / h.count),
      value: novaRound2(h.pnl),
      level,
    });
  }

  const negatives = (list: NovaRankItem[], max: number) =>
    list.filter((i) => i.value < 0).sort((a, b) => a.value - b.value).slice(0, max);
  const positives = (list: NovaRankItem[], max: number) =>
    list.filter((i) => i.value > 0).sort((a, b) => b.value - a.value).slice(0, max);

  return {
    worst: negatives(items, maxItems),
    best: positives(items, maxItems),
    bestHours: positives(hourItems, maxHours),
    worstHours: negatives(hourItems, maxHours),
  };
}
/* ==================== K2 — RENDIMIENTO POR SÍMBOLO (tabla) ====================
 * Antes vivía inline en AnalyticsPage.tsx. Movido aquí para respetar la
 * fuente única de verdad. */
export interface SymbolPerformance {
  symbol: string
  pnl: number
  count: number
  wins: number
  winRate: number
  expectancy: number
}

export function computeBySymbol(trades: Trade[], settings: UserSettings): SymbolPerformance[] {
  const map: Record<string, { pnl: number; count: number; wins: number }> = {};
  for (const t of trades) {
    if (!map[t.symbol]) map[t.symbol] = {pnl: 0, count: 0, wins: 0};
    const net = getNetPnl(t, settings);
    map[t.symbol].pnl += net;
    map[t.symbol].count += 1;
    if (net > settings.breakeven_threshold) map[t.symbol].wins += 1;
  }
  return Object.entries(map)
    .map(([symbol, d]) => ({
      symbol,
      pnl: +d.pnl.toFixed(2),
      count: d.count,
      wins: d.wins,
      winRate: d.count ? Math.round((d.wins / d.count) * 100) : 0,
      expectancy: d.count ? +(d.pnl / d.count).toFixed(2) : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl);
}

/* ==================== K2 — PERFORMANCE POR HORA (Entry o Exit) ====================
 * Función nueva, independiente de computeByHour (que se mantiene intacta para
 * no romper a sus consumidores actuales: Overview, Nova). Esta permite elegir
 * si la hora se mide por entrada o por salida del trade. */
export function computeByHourField(
  trades: Trade[],
  settings: UserSettings,
  field: "entry" | "exit"
) {
  const buckets: Record<number, { pnl: number; wins: number; losses: number; count: number }> = {};
  for (let h = 0; h < 24; h++) buckets[h] = {pnl: 0, wins: 0, losses: 0, count: 0};
  for (const t of trades) {
    const datetime = field === "entry" ? t.entry_datetime : t.exit_datetime;
    const hour = getLocalHourAndDay(datetime).hour;
    const net = getNetPnl(t, settings);
    buckets[hour].pnl += net;
    buckets[hour].count += 1;
    if (net > settings.breakeven_threshold) buckets[hour].wins += 1;
    else if (net < -settings.breakeven_threshold) buckets[hour].losses += 1;
  }
  return Object.entries(buckets)
    .map(([h, d]) => ({hour: Number(h), ...d, winRate: d.count ? Math.round((d.wins / d.count) * 100) : 0}))
    .filter((b) => b.count > 0)
    .sort((a, b) => a.hour - b.hour);
}

/* ==================== K2 — HEATMAP DÍA × HORA ==================== */
export interface HeatmapCell {
  day: number // 0=Dom ... 6=Sáb (igual índice que computeByWeekday)
  hour: number
  pnl: number
  count: number
  wins: number
  winRate: number
}

export function computeHeatmap(trades: Trade[], settings: UserSettings): HeatmapCell[] {
  const buckets: Record<string, { pnl: number; count: number; wins: number }> = {};
  for (const t of trades) {
    const {hour, day} = getLocalHourAndDay(t.entry_datetime);
    const key = `${day}-${hour}`;
    if (!buckets[key]) buckets[key] = {pnl: 0, count: 0, wins: 0};
    const net = getNetPnl(t, settings);
    buckets[key].pnl += net;
    buckets[key].count += 1;
    if (net > settings.breakeven_threshold) buckets[key].wins += 1;
  }
  const cells: HeatmapCell[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const key = `${day}-${hour}`;
      const d = buckets[key];
      cells.push({
        day,
        hour,
        pnl: d ? +d.pnl.toFixed(2) : 0,
        count: d ? d.count : 0,
        wins: d ? d.wins : 0,
        winRate: d && d.count ? Math.round((d.wins / d.count) * 100) : 0,
      });
    }
  }
  return cells;
}

/* ==================== K2 — SYMBOL SESSION MATRIX ==================== */
export interface SymbolSessionCell {
  symbol: string
  session: string
  pnl: number
  count: number
  winRate: number
}

export function computeSymbolSessionMatrix(trades: Trade[], settings: UserSettings): SymbolSessionCell[] {
  const sessionOrder = [...SESSIONS.map((s) => s.label as string), OUT_OF_SESSION_LABEL];
  const buckets: Record<string, { pnl: number; count: number; wins: number }> = {};
  const symbols = new Set<string>();
  for (const t of trades) {
    symbols.add(t.symbol);
    const session = getSession(getLocalHourAndDay(t.entry_datetime).hour);
    const key = `${t.symbol}__${session}`;
    if (!buckets[key]) buckets[key] = {pnl: 0, count: 0, wins: 0};
    const net = getNetPnl(t, settings);
    buckets[key].pnl += net;
    buckets[key].count += 1;
    if (net > settings.breakeven_threshold) buckets[key].wins += 1;
  }
  const cells: SymbolSessionCell[] = [];
  for (const symbol of symbols) {
    for (const session of sessionOrder) {
      const key = `${symbol}__${session}`;
      const d = buckets[key];
      if (!d) continue; // solo celdas con datos reales, evita una tabla gigante vacía
      cells.push({
        symbol,
        session,
        pnl: +d.pnl.toFixed(2),
        count: d.count,
        winRate: d.count ? Math.round((d.wins / d.count) * 100) : 0,
      });
    }
  }
  return cells;
}

/* ==================== K2 — LONG VS SHORT POR SESIÓN ==================== */
export interface DirectionSessionGroup {
  session: string
  long: { pnl: number; count: number; winRate: number }
  short: { pnl: number; count: number; winRate: number }
}

export function computeDirectionBySession(trades: Trade[], settings: UserSettings): DirectionSessionGroup[] {
  const sessionOrder = [...SESSIONS.map((s) => s.label as string), OUT_OF_SESSION_LABEL];
  const emptySide = () => ({pnl: 0, count: 0, wins: 0});
  type Side = ReturnType<typeof emptySide>;
  const buckets: Record<string, { long: Side; short: Side }> = {};
  sessionOrder.forEach((s) => {
    buckets[s] = {long: emptySide(), short: emptySide()};
  });
  for (const t of trades) {
    const session = getSession(getLocalHourAndDay(t.entry_datetime).hour);
    const net = getNetPnl(t, settings);
    const side = t.direction === "long" ? buckets[session].long : buckets[session].short;
    side.pnl += net;
    side.count += 1;
    if (net > settings.breakeven_threshold) side.wins += 1;
  }
  return sessionOrder
    .filter((s) => buckets[s].long.count > 0 || buckets[s].short.count > 0)
    .map((session) => {
      const toResult = (d: Side) => ({
        pnl: +d.pnl.toFixed(2),
        count: d.count,
        winRate: d.count ? Math.round((d.wins / d.count) * 100) : 0,
      });
      return {session, long: toResult(buckets[session].long), short: toResult(buckets[session].short)};
    });
}

/* ==================== K2 — AVG DAY WIN / AVG DAY LOSS ====================
 * Diferente de computeAvgWinLoss (que promedia por TRADE). Esta agrupa el
 * P&L neto POR DÍA y promedia los días ganadores y perdedores por separado. */
export interface AvgDayWinLossResult {
  avgWinDay: number
  avgLossDay: number
  winDaysCount: number
  lossDaysCount: number
}

export function computeAvgDayWinLoss(trades: Trade[], settings: UserSettings): AvgDayWinLossResult {
  const byDay: Record<string, number> = {};
  for (const t of trades) {
    const day = t.exit_datetime.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + getNetPnl(t, settings);
  }
  const days = Object.values(byDay);
  const winDays = days.filter((d) => d > settings.breakeven_threshold);
  const lossDays = days.filter((d) => d < -settings.breakeven_threshold);
  const avgWinDay = winDays.length ? winDays.reduce((a, b) => a + b, 0) / winDays.length : 0;
  const avgLossDay = lossDays.length ? lossDays.reduce((a, b) => a + b, 0) / lossDays.length : 0;
  return {
    avgWinDay: +avgWinDay.toFixed(2),
    avgLossDay: +avgLossDay.toFixed(2),
    winDaysCount: winDays.length,
    lossDaysCount: lossDays.length,
  };
}

/* ==================== K2 — ROLLING METRICS ====================
 * Ventana móvil por NÚMERO DE TRADES (no por días naturales, para evitar
 * huecos cuando no se opera todos los días). windowSize típico: 30/60/90. */
export interface RollingMetricPoint {
  index: number // nº de trade (1-based) al final de la ventana
  date: string // fecha de salida del último trade de la ventana
  rollingPnl: number // suma de P&L neto dentro de la ventana
  rollingExpectancy: number // P&L medio por trade dentro de la ventana
}

export function computeRollingMetrics(
  trades: Trade[],
  settings: UserSettings,
  windowSize: number
): RollingMetricPoint[] {
  if (trades.length === 0 || windowSize <= 0) return [];
  const sorted = [...trades].sort(
    (a, b) => new Date(a.exit_datetime).getTime() - new Date(b.exit_datetime).getTime()
  );
  const nets = sorted.map((t) => getNetPnl(t, settings));
  const points: RollingMetricPoint[] = [];
  for (let i = windowSize - 1; i < sorted.length; i++) {
    const windowNets = nets.slice(i - windowSize + 1, i + 1);
    const sum = windowNets.reduce((a, b) => a + b, 0);
    points.push({
      index: i + 1,
      date: sorted[i].exit_datetime.slice(0, 10),
      rollingPnl: +sum.toFixed(2),
      rollingExpectancy: +(sum / windowSize).toFixed(2),
    });
  }
  return points;
}
