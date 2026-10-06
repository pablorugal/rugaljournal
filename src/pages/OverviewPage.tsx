import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Sparkles, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { useAppData, useTheme } from '../contexts'
import { MONTHS_ES, fmt } from '../utils'
import {
  computeMetrics, computePerformanceScore, computeExpectancy, computeMaxDrawdown,
  getAccountIdsForGroupFilter,
} from '../calculations'
import { Card, SectionHeader, StatCard, Gauge, Modal } from '../components/ui'
import { SessionClock } from '../components/SessionClock'
import { EconomicCalendarWidget } from '../components/EconomicCalendarWidget'
import { AccountGroupDropdown, Dropdown, type AccountGroupValue } from '../components/Filters'
import { TradeForm } from '../components/TradeForm'
import { ConfidenceTooltip } from '../components/ConfidenceBadge'
import {
  useNovaInsights,
  getConfidenceLevel,
  CONFIDENCE_LABELS,
  CONFIDENCE_COLORS,
  CONFIDENCE_BG,
} from '../lib/useNovaInsights'

const EYEBROW = 'font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-900/40 dark:text-bone-100/40'

/* ==================== NOVA RECALC BUTTON ==================== */
function NovaRecalcButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [lastRun, setLastRun] = useState<string | null>(null)

  const handleRecalc = async () => {
    setStatus('loading')
    try {
      const functions = getFunctions(undefined, 'europe-west1')
      const recalculate = httpsCallable(functions, 'recalculateNovaInsightsNow')
      await recalculate({})
      setLastRun(new Date().toLocaleTimeString())
      setStatus('ok')
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  return (
    <div className="w-full mt-4 pt-4 border-t border-black/5 dark:border-ink-600 flex flex-col items-center gap-3">
      <button
        onClick={handleRecalc}
        disabled={status === 'loading'}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent/10 border border-accent/30 text-accent text-sm font-semibold hover:bg-accent/20 disabled:opacity-50 transition w-full justify-center"
      >
        {status === 'loading' ? (
          <>
            <RefreshCw size={14} className="animate-spin" />
            Calculando insights...
          </>
        ) : (
          <>
            <Sparkles size={14} />
            Actualizar insights Nova
          </>
        )}
      </button>

      {status === 'ok' && (
        <div className="flex items-center gap-1.5 text-xs text-profit">
          <CheckCircle2 size={13} />
          Insights actualizados · {lastRun}
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-1.5 text-xs text-loss">
          <AlertTriangle size={13} />
          Error al recalcular. Revisa la consola.
        </div>
      )}

      {status === 'idle' && lastRun === null && (
        <p className="text-[11px] text-ink-900/40 dark:text-bone-100/40 text-center">
          Se actualiza automáticamente cada noche a las 00:00
        </p>
      )}
    </div>
  )
}

/* ==================== CONFIDENCE DOTS ==================== */
function ConfidenceDots({ level }: { level: 0 | 1 | 2 | 3 }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3].map(i => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-all ${
            i <= level
              ? level === 1
                ? 'bg-accent/60'
                : level === 2
                ? 'bg-accent'
                : 'bg-profit'
              : 'bg-black/10 dark:bg-white/10'
          }`}
        />
      ))}
    </div>
  )
}

/* ==================== NOVA BADGE PANEL ==================== */
function NovaBadgePanel() {
  const { insights, loading } = useNovaInsights()

  if (loading) {
    return (
      <div className="w-full mt-3 pt-3 border-t border-black/5 dark:border-ink-600">
        <p className="text-[11px] text-ink-900/40 dark:text-bone-100/40 text-center">
          Cargando patrones...
        </p>
      </div>
    )
  }

  if (!insights?.dayOfWeek?.length) return null

  const topDays = [...insights.dayOfWeek]
    .filter(d => getConfidenceLevel(d.sampleSize) > 0)
    .sort((a, b) => b.sampleSize - a.sampleSize)
    .slice(0, 3)

  if (topDays.length === 0) return null

  return (
    <div className="w-full mt-3 pt-3 border-t border-black/5 dark:border-ink-600">
      <p className={`${EYEBROW} mb-2`}>
        Patrones detectados
      </p>
      <div className="space-y-2">
        {topDays.map(day => {
          const level = getConfidenceLevel(day.sampleSize)
          return (
            <div
              key={day.label}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg ${CONFIDENCE_BG[level]}`}
            >
              <div className="flex items-center gap-2">
                <ConfidenceDots level={level} />
                <span className="text-xs font-medium">{day.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-ink-900/40 dark:text-bone-100/40">
                  {day.sampleSize} trades
                </span>
                <ConfidenceTooltip level={level}>
                  <span className={`text-[10px] font-semibold ${CONFIDENCE_COLORS[level]}`}>
                    {CONFIDENCE_LABELS[level]}
                  </span>
                </ConfidenceTooltip>
              </div>
            </div>
          )
        })}
      </div>
      <Link
        to="/nova-panel"
        className="mt-2 block text-center text-[10px] text-accent hover:underline"
      >
        Ver análisis completo →
      </Link>
    </div>
  )
}

/* ==================== OVERVIEW PAGE ==================== */
export default function OverviewPage() {
  const { trades, strategies, settings, accounts } = useAppData()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const chartColor = 'rgb(var(--c-accent))'
  const axisColor = isDark ? '#A8A196' : '#78716C'
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [groupFilter, setGroupFilter] = useState<AccountGroupValue>({ instrument: 'Todas', phase: 'Todas' })
  const [showNewTradeModal, setShowNewTradeModal] = useState(false)

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
      map[key].pnl += t.pnl
      map[key].count += 1
      if (t.pnl > 0) map[key].wins += 1
    })
    return Object.values(map).sort((a, b) => b.pnl - a.pnl).slice(0, 5)
  }, [monthTrades, strategies])

  const recentTrades = useMemo(() => {
    const source = accountIds ? trades.filter(t => accountIds.includes(t.account_id || '')) : trades
    return [...source]
      .sort((a, b) => new Date(b.exit_datetime).getTime() - new Date(a.exit_datetime).getTime())
      .slice(0, 5)
  }, [trades, accountIds])

  const groupLabel = groupFilter.instrument === 'Todas'
    ? null
    : (groupFilter.instrument === 'Forex' || groupFilter.instrument === 'Futuros') && groupFilter.phase !== 'Todas'
      ? `${groupFilter.instrument} · ${groupFilter.phase}`
      : groupFilter.instrument

  const monthOptions = MONTHS_ES.map((m, i) => ({ value: String(i), label: m }))
  const yearOptions = [year - 1, year, year + 1].map(y => ({ value: String(y), label: String(y) }))

  return (
    <div>
      <SessionClock />
      <SectionHeader
        eyebrow="Dashboard"
        title="Overview"
        subtitle={`Tu rendimiento consolidado del periodo seleccionado.${groupLabel ? ` · Cuenta: ${groupLabel}` : ''}`}
        right={
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <AccountGroupDropdown value={groupFilter} onChange={setGroupFilter} />
            <Dropdown
              value={String(month)}
              onChange={v => setMonth(Number(v))}
              options={monthOptions}
              align="right"
              widthClass="w-44"
            />
            <Dropdown
              value={String(year)}
              onChange={v => setYear(Number(v))}
              options={yearOptions}
              align="right"
              widthClass="w-28"
            />
            <button
              onClick={() => setShowNewTradeModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light transition"
            >
              <Plus size={16} /> New Trade
            </button>
          </div>
        }
      />

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard label="Net P&L" value={fmt(metrics.netPnl)} positive={metrics.netPnl >= 0} />
        <StatCard label="P&L Bruto" value={fmt(metrics.grossPnl)} sub={`Comisiones: -${metrics.totalCommissions.toFixed(2)}`} positive={metrics.grossPnl >= 0} />
        <StatCard label="Trading Days" value={String(metrics.tradingDays)} />
        <StatCard label="Profit Factor" value={metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)} positive={metrics.profitFactor >= 1} />
        <StatCard label="Best Day" value={metrics.bestDay ? fmt(metrics.bestDay.pnl) : '—'} positive={metrics.bestDay ? metrics.bestDay.pnl >= 0 : null} />
        <StatCard label="Win Rate" value={`${metrics.winRate}%`} sub={`${metrics.wins}W / ${metrics.losses}L`} />
      </div>

      {/* ── Equity curve + Performance Score ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <Card className="xl:col-span-2 p-6">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
            <div>
              <p className={EYEBROW}>Equity Curve</p>
              <h3 className="text-2xl font-bold tracking-tight tabular-nums mt-1">{fmt(metrics.currentEquity)}</h3>
            </div>
            <div className="flex gap-4 text-xs">
              <div className="text-right">
                <p className="text-ink-900/40 dark:text-bone-100/40">Current</p>
                <p className="font-semibold tabular-nums">{fmt(metrics.currentEquity)}</p>
              </div>
              <div className="text-right">
                <p className="text-ink-900/40 dark:text-bone-100/40">Best day</p>
                <p className="font-semibold tabular-nums text-profit">{metrics.bestDay ? fmt(metrics.bestDay.pnl) : '—'}</p>
              </div>
              <div className="text-right">
                <p className="text-ink-900/40 dark:text-bone-100/40">Worst day</p>
                <p className="font-semibold tabular-nums text-loss">{metrics.worstDay ? fmt(metrics.worstDay.pnl) : '—'}</p>
              </div>
            </div>
          </div>
          {metrics.equityCurve.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-ink-900/30 dark:text-bone-100/30 text-sm">
              No equity data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={metrics.equityCurve}>
                <defs>
                  <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColor} stopOpacity={isDark ? 0.35 : 0.4} />
                    <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={axisColor} strokeOpacity={0.18} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value: any) => [fmt(Number(value)), 'Equity']}
                  contentStyle={{
                    background: isDark ? '#14120F' : '#FFFFFF',
                    border: `1px solid ${isDark ? '#2A2620' : '#E7E5E4'}`,
                    borderRadius: 12,
                    fontSize: 12,
                    color: isDark ? '#F5F1E8' : '#0B0A08',
                  }}
                  labelStyle={{ color: axisColor, marginBottom: 2 }}
                  itemStyle={{ color: isDark ? '#F5F1E8' : '#0B0A08' }}
                />
                <Area type="monotone" dataKey="equity" stroke={chartColor} strokeWidth={2} fill="url(#equityGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Performance Score — con badges Nova */}
        <Card className="p-6 flex flex-col items-center">
          <p className={`${EYEBROW} self-start mb-2`}>
            Performance Score
          </p>
          <Gauge score={score} />
          <NovaRecalcButton />
          <NovaBadgePanel />
        </Card>
      </div>

      {/* ── Estrategias + Trades recientes ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-xl font-bold tracking-tight mb-4">Estrategias top</h3>
          {strategyPerf.length === 0 ? (
            <p className="text-sm text-ink-900/40 dark:text-bone-100/40">
              Aun no hay trades etiquetados con una estrategia.
            </p>
          ) : (
            <div className="space-y-3">
              {strategyPerf.map(s => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-ink-900/40 dark:text-bone-100/40">
                      {s.count} trades · {Math.round((s.wins / s.count) * 100)}% WR
                    </p>
                  </div>
                  <span className={`font-semibold tabular-nums ${s.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {fmt(s.pnl)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold tracking-tight">Trades recientes</h3>
            <Link to="/trades" className="text-xs font-medium text-accent hover:underline">Ultimos 10</Link>
          </div>
          {recentTrades.length === 0 ? (
            <p className="text-sm text-ink-900/40 dark:text-bone-100/40">
              No hay operaciones registradas todavia.
            </p>
          ) : (
            <div className="space-y-2">
              {recentTrades.map(t => (
                <div key={t.id} className="flex items-center justify-between text-sm py-2 border-b border-black/5 dark:border-ink-600 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-[10px] font-bold px-2 py-1 rounded ${t.direction === 'long' ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'}`}>
                      {t.direction.toUpperCase()}
                    </span>
                    <div>
                      <p className="font-medium">{t.symbol}</p>
                      <p className="text-xs text-ink-900/40 dark:text-bone-100/40">
                        {new Date(t.exit_datetime).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={`font-semibold tabular-nums ${t.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {fmt(t.pnl)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <EconomicCalendarWidget />
      </div>

      <Modal
        open={showNewTradeModal}
        onClose={() => setShowNewTradeModal(false)}
        widthClass="max-w-4xl"
      >
        <TradeForm onSaved={() => setShowNewTradeModal(false)} />
      </Modal>
    </div>
  )
}
