import { useEffect, useMemo, useState } from 'react'
import { useAppData } from '../contexts'
import {
  computeMetrics, computeExpectancy, computeAvgWinLoss, computeMaxDrawdown,
  filterTrades, computeByHour, computeByWeekday, computeBySession, computeRMultipleDistribution,
  getNetPnl,
} from '../calculations'
import { Card, SectionHeader, StatCard, PillTabs, ChipButton } from '../components/ui'
import { fmt } from '../utils'
import type { InstrumentType } from '../types'

const INSTRUMENT_FILTERS: (InstrumentType | 'all')[] = ['all', 'Futuros', 'Forex', 'Acciones', 'Crypto', 'Opciones']

export default function AnalyticsPage() {
  const [tab, setTab] = useState('overview')
  const { trades, settings, strategies, accounts } = useAppData()
  const [strategyFilter, setStrategyFilter] = useState<string>('all')
  const [instrumentFilter, setInstrumentFilter] = useState<InstrumentType | 'all'>('all')
  const [accountFilter, setAccountFilter] = useState<string>('all')

  const relevantAccounts = useMemo(() => {
    if (instrumentFilter === 'all') return accounts
    return accounts.filter(a => a.instrument_type === instrumentFilter)
  }, [accounts, instrumentFilter])

  useEffect(() => {
    if (accountFilter !== 'all' && !relevantAccounts.some(a => a.id === accountFilter)) {
      setAccountFilter('all')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrumentFilter])

  const filtered = useMemo(
    () => filterTrades(trades, { strategyId: strategyFilter, instrumentType: instrumentFilter, accountId: accountFilter }),
    [trades, strategyFilter, instrumentFilter, accountFilter]
  )

  const metrics = computeMetrics(filtered, settings)
  const expectancy = computeExpectancy(filtered, settings)
  const { avgWin, avgLoss } = computeAvgWinLoss(filtered, settings)
  const maxDD = computeMaxDrawdown(metrics.equityCurve)

  const bySymbol = filtered.reduce((acc: Record<string, { pnl: number; count: number; wins: number }>, t) => {
    if (!acc[t.symbol]) acc[t.symbol] = { pnl: 0, count: 0, wins: 0 }
    const net = getNetPnl(t, settings)
    acc[t.symbol].pnl += net
    acc[t.symbol].count += 1
    if (net > settings.breakeven_threshold) acc[t.symbol].wins += 1
    return acc
  }, {})

  const bySession = computeBySession(filtered, settings)
  const byHour = computeByHour(filtered, settings)
  const byWeekday = computeByWeekday(filtered, settings)
  const { buckets: rBuckets } = computeRMultipleDistribution(filtered, settings)

  const maxHourAbs = Math.max(1, ...byHour.map(h => Math.abs(h.pnl)))
  const maxWeekdayAbs = Math.max(1, ...byWeekday.map(d => Math.abs(d.pnl)))
  const maxRCount = Math.max(1, ...rBuckets.map(b => b.count))

  const selectedAccountName = accountFilter !== 'all' ? accounts.find(a => a.id === accountFilter)?.name : null

  return (
    <div>
      <SectionHeader
        eyebrow="Analytics"
        title="Performance Analytics"
        subtitle={`Métricas profundas sobre tu trading.${selectedAccountName ? ` · Cuenta: ${selectedAccountName}` : ''}`}
      />

      {/* ===== FILTROS ===== */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mr-1">Activo</span>
          {INSTRUMENT_FILTERS.map(opt => (
            <ChipButton key={opt} active={instrumentFilter === opt} onClick={() => setInstrumentFilter(opt)}>
              {opt === 'all' ? 'Todos' : opt}
            </ChipButton>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mr-1">Cuenta</span>
          <select
            value={accountFilter}
            onChange={e => setAccountFilter(e.target.value)}
            className="bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <option value="all">Todas las cuentas</option>
            {relevantAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mr-1">Estrategia</span>
          <select
            value={strategyFilter}
            onChange={e => setStrategyFilter(e.target.value)}
            className="bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <option value="all">Todas las estrategias</option>
            {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-6">
        <PillTabs
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'risk', label: 'Risk' },
            { id: 'instrument', label: 'Instrument' },
            { id: 'session', label: 'Session' },
            { id: 'distribution', label: 'Distribution' },
            { id: 'time', label: 'Tiempo' },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {filtered.length === 0 && (
        <Card className="p-6 mb-6">
          <p className="text-sm text-ink-900/40 dark:text-bone-100/40">No hay operaciones que coincidan con los filtros seleccionados.</p>
        </Card>
      )}

      {tab === 'overview' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Net P&L" value={fmt(metrics.netPnl)} positive={metrics.netPnl >= 0} />
          <StatCard label="Profit Factor" value={metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)} positive={metrics.profitFactor >= 1} />
          <StatCard label="Expectancy" value={fmt(expectancy)} positive={expectancy >= 0} />
          <StatCard label="Recovery Factor" value={maxDD !== 0 ? (metrics.netPnl / Math.abs(maxDD)).toFixed(2) : '—'} />
          <StatCard label="Avg Win" value={fmt(avgWin)} positive />
          <StatCard label="Avg Loss" value={fmt(avgLoss)} positive={false} />
          <StatCard label="Win Rate" value={`${metrics.winRate}%`} positive={metrics.winRate >= 50} />
          <StatCard label="Trading Days" value={String(metrics.tradingDays)} />
        </div>
      )}

      {tab === 'risk' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Max Drawdown" value={fmt(maxDD)} positive={false} />
          <StatCard label="Tamaño posición medio" value={filtered.length ? (filtered.reduce((a, t) => a + t.position_size, 0) / filtered.length).toFixed(1) : '—'} />
          <StatCard label="Avg Win" value={fmt(avgWin)} positive />
          <StatCard label="Avg Loss" value={fmt(avgLoss)} positive={false} />
          <StatCard label="W/L Ratio" value={avgLoss !== 0 ? Math.abs(avgWin / avgLoss).toFixed(2) : '∞'} />
          <StatCard label="Breakevens" value={String(metrics.breakevens)} />
        </div>
      )}

      {tab === 'instrument' && (
        <Card className="p-6">
          {Object.keys(bySymbol).length === 0 ? <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no hay datos por instrumento.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-ink-900/40 dark:text-bone-100/40 border-b border-black/5 dark:border-white/5">
                <th className="py-2">Símbolo</th><th className="py-2">Trades</th><th className="py-2">Win Rate</th><th className="py-2">P&L</th>
              </tr></thead>
              <tbody>{Object.entries(bySymbol).map(([sym, d]) => (
                <tr key={sym} className="border-b border-black/5 dark:border-white/5 last:border-0">
                  <td className="py-2 font-medium">{sym}</td>
                  <td className="py-2">{d.count}</td>
                  <td className="py-2">{d.count ? Math.round((d.wins / d.count) * 100) : 0}%</td>
                  <td className={`py-2 font-semibold ${d.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(d.pnl)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'session' && (
        <Card className="p-6">
          <h3 className="serif text-xl font-semibold mb-4">Rendimiento por sesión</h3>
          {bySession.every(s => s.count === 0) ? (
            <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no hay datos por sesión.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-ink-900/40 dark:text-bone-100/40 border-b border-black/5 dark:border-white/5">
                <th className="py-2">Sesión</th><th className="py-2">Trades</th><th className="py-2">Win Rate</th><th className="py-2">P&L</th>
              </tr></thead>
              <tbody>{bySession.map(s => (
                <tr key={s.name} className="border-b border-black/5 dark:border-white/5 last:border-0">
                  <td className="py-2 font-medium">{s.name}</td>
                  <td className="py-2">{s.count}</td>
                  <td className="py-2">{s.winRate}%</td>
                  <td className={`py-2 font-semibold ${s.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(s.pnl)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'distribution' && (
        <Card className="p-6">
          <h3 className="serif text-xl font-semibold mb-6">R-Multiple Distribution</h3>
          {rBuckets.every(b => b.count === 0) ? (
            <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no hay datos suficientes (requiere el campo "Riesgo $" en tus trades).</p>
          ) : (
            <div className="flex items-end justify-between gap-3 h-64">
              {rBuckets.map(b => (
                <div key={b.label} className="flex-1 flex flex-col items-center justify-end h-full group">
                  <span className="text-xs mb-1 opacity-0 group-hover:opacity-100 transition font-medium">{b.count}</span>
                  <div
                    className="w-full bg-ink-900/15 dark:bg-bone-100/20 rounded-t-lg hover:bg-ink-900/30 dark:hover:bg-bone-100/35 transition"
                    style={{ height: `${(b.count / maxRCount) * 100}%`, minHeight: b.count > 0 ? 4 : 0 }}
                  />
                  <span className="text-[10px] text-ink-900/40 dark:text-bone-100/40 mt-2 text-center">{b.label}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'time' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="serif text-xl font-semibold mb-6">Performance by time</h3>
            {byHour.length === 0 ? (
              <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no hay datos suficientes.</p>
            ) : (
              <div className="flex items-end gap-2 h-56 overflow-x-auto pb-2">
                {byHour.map(h => (
                  <div key={h.hour} title={fmt(h.pnl)} className="flex flex-col items-center justify-end h-full min-w-[32px]">
                    <div
                      className={`w-5 rounded-t-sm transition ${h.pnl >= 0 ? 'bg-ink-900 dark:bg-bone-100' : 'bg-ink-900/25 dark:bg-bone-100/25'}`}
                      style={{ height: `${Math.max((Math.abs(h.pnl) / maxHourAbs) * 100, 4)}%` }}
                    />
                    <span className="text-[9px] text-ink-900/40 dark:text-bone-100/40 mt-2">{h.hour}:00</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="serif text-xl font-semibold mb-6">Performance by day</h3>
            {byWeekday.every(d => d.count === 0) ? (
              <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no hay datos suficientes.</p>
            ) : (
              <div className="space-y-3">
                {byWeekday.map(d => (
                  <div key={d.day} className="flex items-center gap-4">
                    <span className="w-10 text-xs font-medium text-ink-900/50 dark:text-bone-100/50">{d.label}</span>
                    <div className="flex-1 h-6 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${d.pnl >= 0 ? 'bg-ink-900 dark:bg-bone-100' : 'bg-ink-900/30 dark:bg-bone-100/30'}`}
                        style={{ width: `${Math.min((Math.abs(d.pnl) / maxWeekdayAbs) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="w-16 text-xs text-right font-semibold">{d.count ? `${d.winRate}%` : '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}