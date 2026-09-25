import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useAppData } from '../contexts'
import { MONTHS_ES, fmt } from '../utils'
import {
  computeMetrics, computePerformanceScore, computeExpectancy, computeMaxDrawdown,
  getAccountIdsForGroupFilter,
} from '../calculations'
import { Card, SectionHeader, StatCard, Gauge } from '../components/ui'
import { AccountGroupDropdown, type AccountGroupValue } from '../components/Filters'

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black/5 dark:bg-white/5 rounded-lg px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">{label}</p>
      <p className="font-semibold text-sm">{value}</p>
    </div>
  )
}

export default function OverviewPage() {
  const { trades, strategies, settings, accounts } = useAppData()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [groupFilter, setGroupFilter] = useState<AccountGroupValue>({ instrument: 'Todas', phase: 'Todas' })

  const accountIds = useMemo(() => getAccountIdsForGroupFilter(accounts, groupFilter), [accounts, groupFilter])

  const monthTrades = useMemo(() => trades.filter(t => {
    const d = new Date(t.exit_datetime)
    if (d.getMonth() !== month || d.getFullYear() !== year) return false
    if (accountIds && !accountIds.includes(t.account_id || '')) return false
    return true
  }), [trades, month, year, accountIds])

  const metrics = useMemo(() => computeMetrics(monthTrades, settings), [monthTrades, settings])
  const score = computePerformanceScore(metrics)
  const expectancy = computeExpectancy(monthTrades, settings)
  const maxDD = computeMaxDrawdown(metrics.equityCurve)
  const strategyPerf = useMemo(() => {
    const map: Record<string, { name: string; pnl: number; count: number; wins: number }> = {}
    monthTrades.forEach(t => {
      const strat = strategies.find(s => s.id === t.strategy_id)
      const key = strat?.name || t.custom_setup || 'Sin etiquetar'
      if (!map[key]) map[key] = { name: key, pnl: 0, count: 0, wins: 0 }
      map[key].pnl += t.pnl; map[key].count += 1
      if (t.pnl > 0) map[key].wins += 1
    })
    return Object.values(map).sort((a, b) => b.pnl - a.pnl).slice(0, 5)
  }, [monthTrades, strategies])
  const recentTrades = useMemo(() => {
    const source = accountIds ? trades.filter(t => accountIds.includes(t.account_id || '')) : trades
    return [...source].sort((a, b) => new Date(b.exit_datetime).getTime() - new Date(a.exit_datetime).getTime()).slice(0, 5)
  }, [trades, accountIds])

  const groupLabel = groupFilter.instrument === 'Todas'
    ? null
    : (groupFilter.instrument === 'Forex' || groupFilter.instrument === 'Futuros') && groupFilter.phase !== 'Todas'
      ? `${groupFilter.instrument} · ${groupFilter.phase}`
      : groupFilter.instrument

  return (
    <div>
      <SectionHeader eyebrow="Dashboard" title="Overview"
        subtitle={`Tu rendimiento consolidado del periodo seleccionado.${groupLabel ? ` · Cuenta: ${groupLabel}` : ''}`}
        right={
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <AccountGroupDropdown value={groupFilter} onChange={setGroupFilter} />
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="bg-white dark:bg-ink-800 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm">
              {MONTHS_ES.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="bg-white dark:bg-ink-800 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm">
              {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <Link to="/trades" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light"><Plus size={16} /> New Trade</Link>
          </div>
        } />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard label="Net P&L" value={fmt(metrics.netPnl)} positive={metrics.netPnl >= 0} />
        <StatCard label="P&L Bruto" value={fmt(metrics.grossPnl)} sub={`Comisiones: -${metrics.totalCommissions.toFixed(2)}`} positive={metrics.grossPnl >= 0} />
        <StatCard label="Trading Days" value={String(metrics.tradingDays)} />
        <StatCard label="Profit Factor" value={metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)} positive={metrics.profitFactor >= 1} />
        <StatCard label="Best Day" value={metrics.bestDay ? fmt(metrics.bestDay.pnl) : '—'} positive={metrics.bestDay ? metrics.bestDay.pnl >= 0 : null} />
        <StatCard label="Win Rate" value={`${metrics.winRate}%`} sub={`${metrics.wins}W / ${metrics.losses}L`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <Card className="xl:col-span-2 p-6">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40">Equity Curve</p>
              <h3 className="serif text-2xl font-semibold">{fmt(metrics.currentEquity)}</h3>
            </div>
            <div className="flex gap-4 text-xs">
              <div className="text-right"><p className="text-ink-900/40 dark:text-bone-100/40">Current</p><p className="font-semibold">{fmt(metrics.currentEquity)}</p></div>
              <div className="text-right"><p className="text-ink-900/40 dark:text-bone-100/40">Best day</p><p className="font-semibold text-profit">{metrics.bestDay ? fmt(metrics.bestDay.pnl) : '—'}</p></div>
              <div className="text-right"><p className="text-ink-900/40 dark:text-bone-100/40">Worst day</p><p className="font-semibold text-loss">{metrics.worstDay ? fmt(metrics.worstDay.pnl) : '—'}</p></div>
            </div>
          </div>
          {metrics.equityCurve.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-ink-900/30 dark:text-bone-100/30 text-sm">No equity data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={metrics.equityCurve}>
                <defs><linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#111318" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#111318" stopOpacity={0} />
                </linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.08} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="equity" stroke="#111318" strokeWidth={2} fill="url(#equityGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6 flex flex-col items-center">
          <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 self-start mb-2">Performance Score</p>
          <Gauge score={score} />
          <p className="text-xs text-center text-ink-900/50 dark:text-bone-100/50 mt-3 mb-4">Combina tu winrate, profit factor y consistencia para estimar tu nivel de ejecucion este periodo.</p>
          <div className="grid grid-cols-2 gap-3 w-full text-sm">
            <MiniMetric label="Winrate" value={`${metrics.winRate}%`} />
            <MiniMetric label="Max DD" value={fmt(maxDD)} />
            <MiniMetric label="Profit Factor" value={metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)} />
            <MiniMetric label="Sharpe" value="—" />
            <MiniMetric label="Sortino" value="—" />
            <MiniMetric label="Expectancy" value={fmt(expectancy)} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="serif text-xl font-semibold mb-4">Estrategias top</h3>
          {strategyPerf.length === 0 ? <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aun no hay trades etiquetados con una estrategia.</p> : (
            <div className="space-y-3">
              {strategyPerf.map(s => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <div><p className="font-medium">{s.name}</p><p className="text-xs text-ink-900/40 dark:text-bone-100/40">{s.count} trades · {Math.round((s.wins / s.count) * 100)}% WR</p></div>
                  <span className={`font-semibold ${s.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(s.pnl)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="serif text-xl font-semibold">Trades recientes</h3>
            <Link to="/trades" className="text-xs font-medium text-accent hover:underline">Ultimos 10</Link>
          </div>
          {recentTrades.length === 0 ? <p className="text-sm text-ink-900/40 dark:text-bone-100/40">No hay operaciones registradas todavia.</p> : (
            <div className="space-y-2">
              {recentTrades.map(t => (
                <div key={t.id} className="flex items-center justify-between text-sm py-2 border-b border-black/5 dark:border-white/5 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded ${t.direction === 'long' ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'}`}>{t.direction.toUpperCase()}</span>
                    <div><p className="font-medium">{t.symbol}</p><p className="text-xs text-ink-900/40 dark:text-bone-100/40">{new Date(t.exit_datetime).toLocaleDateString()}</p></div>
                  </div>
                  <span className={`font-semibold ${t.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(t.pnl)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}