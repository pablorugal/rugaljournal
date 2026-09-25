import type { Trade, UserSettings, InstrumentType, Direction, TradingAccount, AccountPhase } from './types'
/* ==================== COMISIONES ==================== */
export function getCommissionPerContract(symbol: string, settings: UserSettings) {
  const s = symbol.toUpperCase()
  if (s.includes('MNQ')) return settings.commission_mnq
  if (s.includes('NQ')) return settings.commission_nq
  return 0
}
export function getTradeCommission(trade: Trade, settings: UserSettings) {
  return getCommissionPerContract(trade.symbol, settings) * (trade.position_size || 0)
}
export function getNetPnl(trade: Trade, settings: UserSettings) {
  return trade.pnl - getTradeCommission(trade, settings)
}
export function classifyTrade(trade: Trade, settings: UserSettings): 'win' | 'loss' | 'be' {
  const net = getNetPnl(trade, settings)
  if (Math.abs(net) <= settings.breakeven_threshold) return 'be'
  return net > 0 ? 'win' : 'loss'
}

/* ==================== CÁLCULO AUTOMÁTICO DE P&L ==================== */
// Multiplicador $ por punto para futuros. Añade aquí más símbolos si operas otros.
export const CONTRACT_MULTIPLIERS: Record<string, number> = {
  MNQ: 2, NQ: 20,
  MES: 5, ES: 50,
  MYM: 0.5, YM: 5,
  M2K: 5, RTY: 50,
  MGC: 10, GC: 100,
  MCL: 100, CL: 1000,
}

export function getContractMultiplier(symbol: string): number {
  const s = (symbol || '').toUpperCase().trim()
  const keys = Object.keys(CONTRACT_MULTIPLIERS).sort((a, b) => b.length - a.length)
  for (const k of keys) { if (s.startsWith(k)) return CONTRACT_MULTIPLIERS[k] }
  return 1
}

export function calculateAutoPnl(params: {
  instrument_type: InstrumentType
  symbol: string
  direction: Direction
  entry_price: number
  exit_price: number
  position_size: number
}): number {
  const { instrument_type, symbol, direction, entry_price, exit_price, position_size } = params
  if (!entry_price || !exit_price || !position_size) return 0
  const diff = direction === 'long' ? (exit_price - entry_price) : (entry_price - exit_price)

  if (instrument_type === 'Futuros') {
    const mult = getContractMultiplier(symbol)
    return +(diff * mult * position_size).toFixed(2)
  }
  if (instrument_type === 'Forex') {
    // position_size en lotes estándar (1 lote = 100,000 unidades)
    return +(diff * position_size * 100000).toFixed(2)
  }
  // Acciones / Opciones / otros
  return +(diff * position_size).toFixed(2)
}

/* ==================== MÉTRICAS GENERALES ==================== */
export function computeMetrics(trades: Trade[], settings: UserSettings) {
  if (trades.length === 0) {
    return { netPnl: 0, grossPnl: 0, totalCommissions: 0, tradingDays: 0, profitFactor: 0,
      bestDay: null as any, worstDay: null as any, winRate: 0, wins: 0, losses: 0, breakevens: 0,
      equityCurve: [] as { date: string; equity: number }[], currentEquity: 0 }
  }
  const sorted = [...trades].sort((a, b) => new Date(a.exit_datetime).getTime() - new Date(b.exit_datetime).getTime())
  const byDay: Record<string, number> = {}
  let grossPnl = 0, totalCommissions = 0, wins = 0, losses = 0, breakevens = 0, grossWin = 0, grossLoss = 0
  for (const t of sorted) {
    const net = getNetPnl(t, settings)
    const day = t.exit_datetime.slice(0, 10)
    byDay[day] = (byDay[day] || 0) + net
    grossPnl += t.pnl
    totalCommissions += getTradeCommission(t, settings)
    const cls = classifyTrade(t, settings)
    if (cls === 'win') { wins++; grossWin += net } else if (cls === 'loss') { losses++; grossLoss += Math.abs(net) } else breakevens++
  }
  const days = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0]))
  let equity = 0
  const equityCurve = days.map(([date, pnl]) => { equity += pnl; return { date, equity } })
  const bestDayEntry = days.reduce((best, cur) => (cur[1] > (best?.[1] ?? -Infinity) ? cur : best), null as [string, number] | null)
  const worstDayEntry = days.reduce((worst, cur) => (cur[1] < (worst?.[1] ?? Infinity) ? cur : worst), null as [string, number] | null)
  return {
    netPnl: grossPnl - totalCommissions, grossPnl, totalCommissions, tradingDays: days.length,
    profitFactor: grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : grossWin > 0 ? Infinity : 0,
    bestDay: bestDayEntry ? { date: bestDayEntry[0], pnl: bestDayEntry[1] } : null,
    worstDay: worstDayEntry ? { date: worstDayEntry[0], pnl: worstDayEntry[1] } : null,
    winRate: wins + losses > 0 ? +((wins / (wins + losses)) * 100).toFixed(1) : 0,
    wins, losses, breakevens, equityCurve, currentEquity: equity,
  }
}
export function computePerformanceScore(m: ReturnType<typeof computeMetrics>) {
  const wrScore = Math.min(m.winRate, 100) * 0.4
  const pfScore = Math.min((m.profitFactor === Infinity ? 3 : m.profitFactor) / 3, 1) * 40
  const consistencyScore = Math.min(m.tradingDays / 20, 1) * 20
  const total = wrScore * 0.5 + pfScore + consistencyScore * 0.5
  return Math.round(total > 100 ? 100 : total)
}
export function computeExpectancy(trades: Trade[], settings: UserSettings) {
  if (trades.length === 0) return 0
  const total = trades.reduce((acc, t) => acc + getNetPnl(t, settings), 0)
  return +(total / trades.length).toFixed(2)
}
export function computeAvgWinLoss(trades: Trade[], settings: UserSettings) {
  const wins = trades.filter(t => classifyTrade(t, settings) === 'win').map(t => getNetPnl(t, settings))
  const losses = trades.filter(t => classifyTrade(t, settings) === 'loss').map(t => getNetPnl(t, settings))
  const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0
  return { avgWin: +avgWin.toFixed(2), avgLoss: +avgLoss.toFixed(2) }
}
export function computeMaxDrawdown(equityCurve: { date: string; equity: number }[]) {
  let peak = -Infinity, maxDD = 0
  for (const p of equityCurve) { peak = Math.max(peak, p.equity); maxDD = Math.min(maxDD, p.equity - peak) }
  return maxDD
}

/* ==================== FILTROS (Estrategia / Instrumento) ==================== */
export function filterTrades(trades: Trade[], opts: { strategyId?: string | 'all'; instrumentType?: InstrumentType | 'all'; accountId?: string | 'all' }) {
  return trades.filter(t => {
    if (opts.strategyId && opts.strategyId !== 'all' && t.strategy_id !== opts.strategyId) return false
    if (opts.instrumentType && opts.instrumentType !== 'all' && t.instrument_type !== opts.instrumentType) return false
    if (opts.accountId && opts.accountId !== 'all' && t.account_id !== opts.accountId) return false
    return true
  })
}
/* ==================== PERFORMANCE POR HORA ==================== */
export function computeByHour(trades: Trade[], settings: UserSettings) {
  const buckets: Record<number, { pnl: number; wins: number; losses: number; count: number }> = {}
  for (let h = 0; h < 24; h++) buckets[h] = { pnl: 0, wins: 0, losses: 0, count: 0 }
  for (const t of trades) {
    const hour = new Date(t.entry_datetime).getHours()
    const net = getNetPnl(t, settings)
    buckets[hour].pnl += net
    buckets[hour].count += 1
    if (net > settings.breakeven_threshold) buckets[hour].wins += 1
    else if (net < -settings.breakeven_threshold) buckets[hour].losses += 1
  }
  return Object.entries(buckets)
    .map(([h, d]) => ({ hour: Number(h), ...d, winRate: d.count ? Math.round((d.wins / d.count) * 100) : 0 }))
    .filter(b => b.count > 0)
    .sort((a, b) => a.hour - b.hour)
}

/* ==================== PERFORMANCE POR DÍA DE LA SEMANA ==================== */
const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
export function computeByWeekday(trades: Trade[], settings: UserSettings) {
  const buckets: Record<number, { pnl: number; wins: number; losses: number; count: number }> = {}
  for (let d = 0; d < 7; d++) buckets[d] = { pnl: 0, wins: 0, losses: 0, count: 0 }
  for (const t of trades) {
    const day = new Date(t.entry_datetime).getDay()
    const net = getNetPnl(t, settings)
    buckets[day].pnl += net
    buckets[day].count += 1
    if (net > settings.breakeven_threshold) buckets[day].wins += 1
    else if (net < -settings.breakeven_threshold) buckets[day].losses += 1
  }
  return Object.entries(buckets).map(([d, data]) => ({
    day: Number(d), label: WEEKDAY_LABELS[Number(d)], ...data,
    winRate: data.count ? Math.round((data.wins / data.count) * 100) : 0,
  }))
}

/* ==================== PERFORMANCE POR SESIÓN ==================== */
export function computeBySession(trades: Trade[], settings: UserSettings) {
  const sessions: Record<string, { pnl: number; count: number; wins: number }> = {
    'Asia': { pnl: 0, count: 0, wins: 0 },
    'Londres': { pnl: 0, count: 0, wins: 0 },
    'Nueva York': { pnl: 0, count: 0, wins: 0 },
    'Otra': { pnl: 0, count: 0, wins: 0 },
  }
  for (const t of trades) {
    const h = new Date(t.entry_datetime).getUTCHours()
    let key = 'Otra'
    if (h >= 0 && h < 7) key = 'Asia'
    else if (h >= 7 && h < 12) key = 'Londres'
    else if (h >= 12 && h < 21) key = 'Nueva York'
    const net = getNetPnl(t, settings)
    sessions[key].pnl += net
    sessions[key].count += 1
    if (net > settings.breakeven_threshold) sessions[key].wins += 1
  }
  return Object.entries(sessions).map(([name, d]) => ({ name, ...d, winRate: d.count ? Math.round((d.wins / d.count) * 100) : 0 }))
}

/* ==================== DISTRIBUCIÓN R-MULTIPLE ==================== */
export function computeRMultipleDistribution(trades: Trade[], settings: UserSettings) {
  const buckets = [
    { label: '< -2R', min: -Infinity, max: -2, count: 0 },
    { label: '-2 a -1R', min: -2, max: -1, count: 0 },
    { label: '-1 a 0R', min: -1, max: 0, count: 0 },
    { label: '0 a 1R', min: 0, max: 1, count: 0 },
    { label: '1 a 2R', min: 1, max: 2, count: 0 },
    { label: '> 2R', min: 2, max: Infinity, count: 0 },
  ]
  let skipped = 0
  for (const t of trades) {
    if (!t.risk_amount || t.risk_amount === 0) { skipped++; continue }
    const net = getNetPnl(t, settings)
    const r = net / t.risk_amount
    const bucket = buckets.find(b => r >= b.min && r < b.max)
    if (bucket) bucket.count += 1
    else if (r >= 2) buckets[buckets.length - 1].count += 1
  }
  return { buckets, skipped }
}
import type { MindsetEntry } from './types'

/* ==================== COLOR DEL DÍA (MINDSET) ==================== */
export type DayMood = 'green' | 'yellow' | 'red' | 'none'

export function getMindsetDayColor(entry?: MindsetEntry): DayMood {
  if (!entry) return 'none'
  let score = 0
  let signals = 0

  if (entry.conviction !== undefined) { signals++; score += entry.conviction ? 1 : -2 }
  if (entry.wrong_decision !== undefined) { signals++; score += entry.wrong_decision ? -1.5 : 1 }
  if (entry.followed_plan) {
    signals++
    if (entry.followed_plan === 'yes') score += 1.5
    else if (entry.followed_plan === 'partial') score += 0
    else score -= 1.5
  }
  if (entry.close_emotion !== undefined) {
    signals++
    if (entry.close_emotion >= 7) score += 1
    else if (entry.close_emotion <= 4) score -= 1
  }
  if (entry.change_vs_start) {
    signals++
    if (entry.change_vs_start === 'mejor') score += 1
    else if (entry.change_vs_start === 'peor') score -= 1
  }
  if (entry.needed_to_recover !== undefined) { signals++; score += entry.needed_to_recover ? -1 : 0.5 }

  if (signals === 0) return 'none'
  const avg = score / signals
  if (avg <= -0.5) return 'red'
  if (avg >= 0.6) return 'green'
  return 'yellow'
}
/* ==================== CUENTAS ==================== */
export function computeAccountStats(account: TradingAccount, trades: Trade[], settings: UserSettings) {
  const accountTrades = trades.filter(t => t.account_id === account.id)
  const netPnl = accountTrades.reduce((acc, t) => acc + getNetPnl(t, settings), 0)
  const balance = account.initial_balance + netPnl
  const pnlPct = account.initial_balance > 0 ? +((netPnl / account.initial_balance) * 100).toFixed(2) : 0

  let progressPct: number | null = null
  if (account.category === 'Prop Firm' && account.profit_target_pct && account.phase !== 'Funded') {
    progressPct = Math.min(100, Math.max(0, +((pnlPct / account.profit_target_pct) * 100).toFixed(1)))
  }

  return { tradesCount: accountTrades.length, netPnl: +netPnl.toFixed(2), balance: +balance.toFixed(2), pnlPct, progressPct }
}

export function getAccountGroupLabel(account: TradingAccount): string {
  if (account.category === 'Capital Real') return `${account.instrument_type} · Capital Real`
  return `${account.instrument_type} · ${account.phase || 'Prop Firm'}`
}

export function groupAccountsByPhase(accounts: TradingAccount[], trades: Trade[], settings: UserSettings) {
  const groups: Record<string, { label: string; instrument_type: InstrumentType; accounts: TradingAccount[]; initial: number; balance: number; netPnl: number }> = {}
  accounts.forEach(acc => {
    const label = getAccountGroupLabel(acc)
    if (!groups[label]) groups[label] = { label, instrument_type: acc.instrument_type, accounts: [], initial: 0, balance: 0, netPnl: 0 }
    const stats = computeAccountStats(acc, trades, settings)
    groups[label].accounts.push(acc)
    groups[label].initial += acc.initial_balance
    groups[label].balance += stats.balance
    groups[label].netPnl += stats.netPnl
  })
  return Object.values(groups).sort((a, b) => a.label.localeCompare(b.label))
}

/* ==================== FILTRO DE GRUPO (Instrumento + Fase) — usado en Panel ==================== */
export interface AccountGroupFilter {
  instrument: InstrumentType | 'Todas'
  phase: AccountPhase | 'Capital Real' | 'Todas'
}

/**
 * Devuelve los IDs de cuenta que caen dentro del grupo instrumento+fase seleccionado.
 * Devuelve null si el filtro es "Todas" (sin filtrar nada).
 */
export function getAccountIdsForGroupFilter(accounts: TradingAccount[], filter: AccountGroupFilter): string[] | null {
  if (filter.instrument === 'Todas') return null
  let matched = accounts.filter(a => a.instrument_type === filter.instrument)
  if (filter.phase && filter.phase !== 'Todas') {
    if (filter.phase === 'Capital Real') {
      matched = matched.filter(a => a.category === 'Capital Real')
    } else {
      matched = matched.filter(a => a.category === 'Prop Firm' && a.phase === filter.phase)
    }
  }
  return matched.map(a => a.id)
}