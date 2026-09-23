import type { Trade, UserSettings } from './types'

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