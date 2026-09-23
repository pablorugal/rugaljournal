import { useState } from 'react'
import { useAppData } from '../contexts'
import { computeMetrics, computeExpectancy, computeAvgWinLoss, computeMaxDrawdown } from '../calculations'
import { Card, SectionHeader, StatCard, PillTabs } from '../components/ui'
import { fmt } from '../utils'

export default function AnalyticsPage() {
  const [tab, setTab] = useState('overview')
  const { trades, settings } = useAppData()
  const metrics = computeMetrics(trades, settings)
  const expectancy = computeExpectancy(trades, settings)
  const { avgWin, avgLoss } = computeAvgWinLoss(trades, settings)
  const maxDD = computeMaxDrawdown(metrics.equityCurve)
  const bySymbol = trades.reduce((acc: Record<string, { pnl: number; count: number }>, t) => {
    if (!acc[t.symbol]) acc[t.symbol] = { pnl: 0, count: 0 }
    acc[t.symbol].pnl += t.pnl; acc[t.symbol].count += 1
    return acc
  }, {})
  return (
    <div>
      <SectionHeader eyebrow="Analytics" title="Performance Analytics" subtitle="Métricas profundas sobre tu trading." />
      <div className="mb-6"><PillTabs tabs={[{ id: 'overview', label: 'Overview' }, { id: 'risk', label: 'Risk' }, { id: 'instrument', label: 'Instrument' }, { id: 'session', label: 'Session' }, { id: 'distribution', label: 'Distribution' }]} active={tab} onChange={setTab} /></div>
      {tab === 'overview' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Net P&L" value={fmt(metrics.netPnl)} positive={metrics.netPnl >= 0} />
          <StatCard label="Profit Factor" value={metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)} positive={metrics.profitFactor >= 1} />
          <StatCard label="Expectancy" value={fmt(expectancy)} positive={expectancy >= 0} />
          <StatCard label="Recovery Factor" value={maxDD !== 0 ? (metrics.netPnl / Math.abs(maxDD)).toFixed(2) : '—'} />
          <StatCard label="Avg Win" value={fmt(avgWin)} positive />
          <StatCard label="Avg Loss" value={fmt(avgLoss)} positive={false} />
          <StatCard label="Sharpe" value="—" />
          <StatCard label="Sortino" value="—" />
        </div>
      )}
      {tab === 'risk' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Max Drawdown" value={fmt(maxDD)} positive={false} />
          <StatCard label="Tamaño posición medio" value={trades.length ? (trades.reduce((a, t) => a + t.position_size, 0) / trades.length).toFixed(1) : '—'} />
          <StatCard label="Ratio Riesgo/Beneficio" value="—" />
        </div>
      )}
      {tab === 'instrument' && (
        <Card className="p-6">
          {Object.keys(bySymbol).length === 0 ? <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no hay datos por instrumento.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-ink-900/40 dark:text-bone-100/40 border-b border-black/5 dark:border-white/5"><th className="py-2">Símbolo</th><th className="py-2">Trades</th><th className="py-2">P&L</th></tr></thead>
              <tbody>{Object.entries(bySymbol).map(([sym, d]) => (
                <tr key={sym} className="border-b border-black/5 dark:border-white/5 last:border-0"><td className="py-2 font-medium">{sym}</td><td className="py-2">{d.count}</td><td className={`py-2 font-semibold ${d.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(d.pnl)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Card>
      )}
      {tab === 'session' && <Card className="p-6"><p className="text-sm text-ink-900/40 dark:text-bone-100/40">Rendimiento por sesión de mercado — próximamente.</p></Card>}
      {tab === 'distribution' && <Card className="p-6"><p className="text-sm text-ink-900/40 dark:text-bone-100/40">Histograma de distribución de P&L — próximamente.</p></Card>}
    </div>
  )
}