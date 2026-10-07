import { useEffect, useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ScatterChart, Scatter, Cell, BarChart, Bar, PieChart, Pie, AreaChart, Area,
} from 'recharts'
import { useAppData, useTheme } from '../contexts'
import {
  computeMetrics, computeExpectancy, computeAvgWinLoss, computeMaxDrawdown, computeStdDevSharpe,
  filterTrades, computeByHourField, computeByWeekday, computeBySession, computeRMultipleDistribution,
  computeBySymbol, computeHeatmap, computeSymbolSessionMatrix, computeDirectionBySession,
  computeAvgDayWinLoss, computeRollingMetrics, computeStreaks, computePerformanceScoreBreakdown,
  correlateChecklistUsage, correlateAllRules, setCorrelationSettings,
} from '../calculations'
import {
  Card, SectionHeader, StatCard, ChipButton,
  RankedTableCard, HeatmapGrid, MatrixTable,
  type BarRowItem, type MatrixCellData,
} from '../components/ui'
import { InstrumentDropdown, Dropdown, ColumnsDropdown, type CheckboxGroup } from '../components/Filters'
import { fmt } from '../utils'
import { ConfidenceBadge } from '../components/ConfidenceBadge'
import { Flame, Snowflake } from 'lucide-react'
import type { InstrumentType } from '../types'
import { InfoTooltip } from '../components/InfoTooltip'

const INSTRUMENT_FILTERS: (InstrumentType | 'all')[] = ['all', 'Futuros', 'Forex', 'Acciones', 'Crypto', 'Opciones']
const ROLLING_WINDOWS: (30 | 60 | 90)[] = [30, 60, 90]
const DURATION_OUTLIER_THRESHOLD_MIN = 1440 // 24h: duraciones mayores se consideran error de datos
const HOLD_TIME_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '0-5min', min: 0, max: 5 },
  { label: '5-15min', min: 5, max: 15 },
  { label: '15-30min', min: 15, max: 30 },
  { label: '30-60min', min: 30, max: 60 },
  { label: '1-2h', min: 60, max: 120 },
  { label: '2h+', min: 120, max: Infinity },
]
const SESSION_ORDER_SHORT = ['Asia', 'Londres', 'Solapamiento NY-Londres', 'Nueva York', 'Fuera de sesión']
const SYMBOL_DONUT_COLORS = ['#D97757', '#7C9885', '#C9A449', '#6B8CAE', '#A47EB5', '#B5765C', '#5FA8A0', '#C77B8E']

const ALL_SECTIONS = [
  'summary', 'monthlyProfit', 'riskStats', 'avgDay', 'rMultiple', 'rolling', 'durationProfit', 'holdTimeSweetSpot', 'riskCompound',
  'bestWorstHour', 'bestWorstWeekday', 'heatmap', 'tradeDistribution',
  'symbols', 'symbolMetrics', 'sessions', 'matrix', 'longShort',
  'checklistDiscipline', 'habitsDiscipline',
] as const
type SectionKey = typeof ALL_SECTIONS[number]

const STORAGE_KEY = 'tj_analytics_visible_sections'

function loadVisibleSections(): Set<SectionKey> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set(ALL_SECTIONS)
    const arr = JSON.parse(raw) as string[]
    const valid = arr.filter((k): k is SectionKey => (ALL_SECTIONS as readonly string[]).includes(k))
    return new Set(valid.length ? valid : ALL_SECTIONS)
  } catch {
    return new Set(ALL_SECTIONS)
  }
}

const SECTION_GROUPS: CheckboxGroup[] = [
  { label: 'Rendimiento', options: [
    { value: 'summary', label: 'Resumen general' },
    { value: 'monthlyProfit', label: 'Monthly Profit' },
    { value: 'riskCompound', label: 'Balance & Rachas' },
  ]},
  { label: 'Riesgo', options: [
    { value: 'riskStats', label: 'Métricas de riesgo' },
    { value: 'avgDay', label: 'Avg Day Win/Loss' },
    { value: 'rMultiple', label: 'R-Multiple Distribution' },
    { value: 'rolling', label: 'Rolling Metrics' },
    { value: 'durationProfit', label: 'Duration vs Profit' },
    { value: 'holdTimeSweetSpot', label: 'Hold Time Sweet Spot' },
  ]},
  { label: 'Horarios', options: [
    { value: 'bestWorstHour', label: 'Mejor/peor hora' },
    { value: 'bestWorstWeekday', label: 'Mejor/peor día de semana' },
    { value: 'heatmap', label: 'Heatmap día × hora' },
    { value: 'tradeDistribution', label: 'Trade Distribution' },
  ]},
  { label: 'Mercados', options: [
    { value: 'symbols', label: 'Símbolos operados' },
    { value: 'symbolMetrics', label: 'Symbol Metrics' },
    { value: 'sessions', label: 'Rendimiento por sesión' },
    { value: 'matrix', label: 'Matriz símbolo × sesión' },
    { value: 'longShort', label: 'Long vs Short por sesión' },
  ]},
  { label: 'Disciplina', options: [
    { value: 'checklistDiscipline', label: 'Checklist vs Rendimiento' },
    { value: 'habitsDiscipline', label: 'Hábitos vs Rendimiento' },
  ]},
]

function shortSessionLabel(label: string): string {
  const idx = label.indexOf(' (')
  return idx > -1 ? label.slice(0, idx) : label
}

function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

function formatDurationTick(min: number): string {
  if (min < 60) return `${Math.round(min)}min`
  return `${Math.round(min / 60)}h`
}

function CategoryTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-900/40 dark:text-bone-100/40 mb-4">
      {children}
    </h2>
  )
}

function ChecklistCorrelationCard({ checklistCorrelation }: { checklistCorrelation: ReturnType<typeof correlateChecklistUsage> }) {
  const [gWith, gWithout] = checklistCorrelation.groups
  const hasData = gWith.sampleSize > 0 || gWithout.sampleSize > 0
  const deltaPositive = checklistCorrelation.delta >= 0
  return (
    <Card className="p-6">
      <div className="flex items-center mb-2">
        <h3 className="serif text-xl font-semibold">Checklist vs Rendimiento</h3>
        <InfoTooltip text="Compara el win rate de los trades en los que usaste una checklist de confluencias frente a los que no, para ver si de verdad te ayuda a operar mejor." />
      </div>
      {!hasData ? (
        <p className="text-sm text-ink-900/40 dark:text-bone-100/40 mt-4">Aún no hay datos suficientes. Vincula una checklist a tus trades para ver esta comparación.</p>
      ) : (
        <>
          <p className={`text-sm font-semibold mb-6 ${deltaPositive ? 'text-profit' : 'text-loss'}`}>
            {deltaPositive ? '+' : ''}{checklistCorrelation.delta} pts de win rate usando checklist
          </p>
          <div className="space-y-5">
            {checklistCorrelation.groups.map(g => (
              <div key={g.label}>
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <span className="text-sm font-medium flex items-center gap-2">
                    {g.label}
                    <ConfidenceBadge level={g.confidenceLevel} />
                  </span>
                  <span className="text-sm font-semibold tabular-nums shrink-0">{g.winRate}%</span>
                </div>
                <div className="h-2 rounded-full bg-black/5 dark:bg-white/5">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, g.winRate)}%` }} />
                </div>
                <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mt-1">
                  {g.sampleSize} trades · Avg P&L {fmt(g.avgPnl)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}

function HabitsCorrelationCard({ ruleCorrelations }: { ruleCorrelations: ReturnType<typeof correlateAllRules> }) {
  return (
    <Card className="p-6">
      <div className="flex items-center mb-2">
        <h3 className="serif text-xl font-semibold">Hábitos vs Rendimiento</h3>
        <InfoTooltip text="Para cada regla de trading, compara tu win rate los días que la cumpliste frente a los días que no, para saber qué hábitos influyen de verdad en tu rendimiento." />
      </div>
      {ruleCorrelations.length === 0 ? (
        <p className="text-sm text-ink-900/40 dark:text-bone-100/40 mt-4">Aún no tienes reglas de hábito creadas. Añádelas en la página de Hábitos.</p>
      ) : (
        <div className="space-y-5 mt-6 max-h-[400px] overflow-y-auto pr-1">
          {ruleCorrelations.map(rc => {
            const [gFollowed, gNotFollowed] = rc.groups
            const hasData = gFollowed.sampleSize > 0 || gNotFollowed.sampleSize > 0
            const deltaPositive = rc.delta >= 0
            return (
              <div key={rc.dimension} className="pb-5 border-b border-black/5 dark:border-white/5 last:border-0 last:pb-0">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="text-sm font-medium">{rc.dimension.replace('Regla: ', '')}</span>
                  <ConfidenceBadge level={rc.deltaConfidence} />
                </div>
                {!hasData ? (
                  <p className="text-xs text-ink-900/40 dark:text-bone-100/40">Aún no hay datos suficientes para esta regla.</p>
                ) : (
                  <>
                    <p className={`text-xs font-semibold mb-2 ${deltaPositive ? 'text-profit' : 'text-loss'}`}>
                      {deltaPositive ? '+' : ''}{rc.delta} pts de win rate cumpliéndola
                    </p>
                    <div className="space-y-2">
                      {rc.groups.map(g => (
                        <div key={g.label}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-ink-900/60 dark:text-bone-100/60">{g.label}</span>
                            <span className="font-semibold tabular-nums">{g.winRate}% · {g.sampleSize} trades</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/5">
                            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, g.winRate)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

export default function AnalyticsPage() {
  const { trades, settings, strategies, accounts, checklists, habitRules, habitLogs } = useAppData()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const axisColor = isDark ? '#A8A196' : '#78716C'
  const [strategyFilter, setStrategyFilter] = useState<string>('all')
  const [instrumentFilter, setInstrumentFilter] = useState<InstrumentType | 'all'>('all')
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [hourField, setHourField] = useState<'entry' | 'exit'>('entry')
  const [rollingWindow, setRollingWindow] = useState<30 | 60 | 90>(30)
  const [distributionField, setDistributionField] = useState<'entry' | 'exit'>('entry')
  const [visibleSections, setVisibleSections] = useState<Set<SectionKey>>(() => loadVisibleSections())

  const toggleSection = (key: string) => {
    setVisibleSections(prev => {
      const next = new Set(prev)
      if (next.has(key as SectionKey)) next.delete(key as SectionKey)
      else next.add(key as SectionKey)
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      return next
    })
  }
  const isVisible = (key: SectionKey) => visibleSections.has(key)

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
  const scoreBreakdown = computePerformanceScoreBreakdown(metrics)
  const expectancy = computeExpectancy(filtered, settings)
  const { avgWin, avgLoss } = computeAvgWinLoss(filtered, settings)
  const maxDD = computeMaxDrawdown(metrics.equityCurve)
  const stdDevSharpe = computeStdDevSharpe(metrics.equityCurve)
  const streaks = computeStreaks(filtered, settings)
  const underwaterCurve = useMemo(() => {
    let peak = -Infinity
    return metrics.equityCurve.map(p => {
      peak = Math.max(peak, p.equity)
      return { date: p.date, drawdown: +(p.equity - peak).toFixed(2) }
    })
  }, [metrics.equityCurve])
  const highestEquity = useMemo(
    () => metrics.equityCurve.reduce((max, p) => Math.max(max, p.equity), 0),
    [metrics.equityCurve]
  )
  const avgDayWinLoss = computeAvgDayWinLoss(filtered, settings)
  const rollingPoints = computeRollingMetrics(filtered, settings, rollingWindow)

  const checklistCorrelation = useMemo(() => {
    setCorrelationSettings(settings)
    return correlateChecklistUsage(filtered, checklists)
  }, [filtered, checklists, settings])

  const ruleCorrelations = useMemo(() => {
    setCorrelationSettings(settings)
    return correlateAllRules(filtered, habitLogs, habitRules)
  }, [filtered, habitLogs, habitRules, settings])

  const durationProfitData = useMemo(() => {
    const points: { duration: number; pnl: number; symbol: string }[] = []
    let excluded = 0
    filtered.forEach(t => {
      const entryMs = new Date(t.entry_datetime).getTime()
      const exitMs = new Date(t.exit_datetime).getTime()
      if (Number.isNaN(entryMs) || Number.isNaN(exitMs) || exitMs <= entryMs) return
      const duration = +((exitMs - entryMs) / 60000).toFixed(1)
      if (duration > DURATION_OUTLIER_THRESHOLD_MIN) { excluded++; return }
      points.push({ duration, pnl: t.pnl, symbol: t.symbol })
    })
    return { points, excluded }
  }, [filtered])

  const holdTimeItems: BarRowItem[] = useMemo(() => {
    return HOLD_TIME_BUCKETS.map(bucket => {
      const subset = filtered.filter(t => {
        const entryMs = new Date(t.entry_datetime).getTime()
        const exitMs = new Date(t.exit_datetime).getTime()
        if (Number.isNaN(entryMs) || Number.isNaN(exitMs) || exitMs <= entryMs) return false
        const duration = (exitMs - entryMs) / 60000
        if (duration > DURATION_OUTLIER_THRESHOLD_MIN) return false
        return duration >= bucket.min && duration < bucket.max
      })
      const count = subset.length
      const pnl = subset.reduce((a, t) => a + t.pnl, 0)
      const wins = subset.filter(t => t.pnl > 0).length
      const winRate = count ? Math.round((wins / count) * 100) : 0
      const expectancy = count ? +(pnl / count).toFixed(2) : 0
      return { key: bucket.label, label: bucket.label, value: pnl, count, winRate, expectancy }
    })
  }, [filtered])

  const monthlyProfitData = useMemo(() => {
    const map = new Map<string, number>()
    filtered.forEach(t => {
      const d = new Date(t.exit_datetime)
      if (Number.isNaN(d.getTime())) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      map.set(key, (map.get(key) || 0) + t.pnl)
    })
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, pnl]) => ({ month, pnl: +pnl.toFixed(2) }))
  }, [filtered])

  const distributionByHour = useMemo(
    () => computeByHourField(filtered, settings, distributionField),
    [filtered, settings, distributionField]
  )
  const tradeDistributionData = useMemo(
    () => distributionByHour.map(h => ({ hour: hourLabel(h.hour), count: h.count })),
    [distributionByHour]
  )

  const bySymbol = computeBySymbol(filtered, settings)

  const symbolMetricsData = useMemo(() => {
    const totalCount = bySymbol.reduce((a, s) => a + s.count, 0)
    return bySymbol
      .filter(s => s.count > 0)
      .sort((a, b) => b.count - a.count)
      .map(s => ({ symbol: s.symbol, count: s.count, pct: totalCount ? Math.round((s.count / totalCount) * 100) : 0 }))
  }, [bySymbol])
  const bySession = computeBySession(filtered, settings)
  const byHour = computeByHourField(filtered, settings, hourField)
  const byWeekday = computeByWeekday(filtered, settings)
  const { buckets: rBuckets } = computeRMultipleDistribution(filtered, settings)
  const heatmapCells = computeHeatmap(filtered, settings)
  const symbolSessionCells = computeSymbolSessionMatrix(filtered, settings)
  const directionBySession = computeDirectionBySession(filtered, settings)

  const maxRCount = Math.max(1, ...rBuckets.map(b => b.count))

  const hourItems: BarRowItem[] = byHour
    .map(h => ({
      key: `hour-${h.hour}`,
      label: hourLabel(h.hour),
      value: h.pnl,
      count: h.count,
      winRate: h.winRate,
      expectancy: h.count ? +(h.pnl / h.count).toFixed(2) : 0,
    }))
    .sort((a, b) => b.value - a.value)

  const weekdayItems: BarRowItem[] = byWeekday
    .filter(d => d.count > 0)
    .map(d => ({
      key: `day-${d.day}`,
      label: d.label,
      value: d.pnl,
      count: d.count,
      winRate: d.winRate,
      expectancy: d.count ? +(d.pnl / d.count).toFixed(2) : 0,
    }))
    .sort((a, b) => b.value - a.value)

  const symbolItems: BarRowItem[] = bySymbol
    .map(s => ({
      key: s.symbol,
      label: s.symbol,
      value: s.pnl,
      count: s.count,
      winRate: s.winRate,
      expectancy: s.expectancy,
    }))
    .sort((a, b) => b.value - a.value)

  const sessionItems: BarRowItem[] = bySession
    .filter(s => s.count > 0)
    .map(s => ({
      key: s.name,
      label: shortSessionLabel(s.name),
      value: s.pnl,
      count: s.count,
      winRate: s.winRate,
      expectancy: s.count ? +(s.pnl / s.count).toFixed(2) : 0,
    }))
    .sort((a, b) => b.value - a.value)

  const matrixRows = Array.from(new Set(symbolSessionCells.map(c => c.symbol))).sort()
  const presentSessions = new Set(symbolSessionCells.map(c => shortSessionLabel(c.session)))
  const matrixCols = SESSION_ORDER_SHORT.filter(s => presentSessions.has(s))
  const matrixCells: MatrixCellData[] = symbolSessionCells.map(c => ({
    rowKey: c.symbol,
    colKey: shortSessionLabel(c.session),
    pnl: c.pnl,
    count: c.count,
    winRate: c.winRate,
  }))

  const selectedAccountName = accountFilter !== 'all' ? accounts.find(a => a.id === accountFilter)?.name : null
  const instrumentOptions = INSTRUMENT_FILTERS.map(opt => ({ value: opt, label: opt === 'all' ? 'Todos' : opt }))

  const showPerformanceCategory = isVisible('summary') || isVisible('monthlyProfit') || isVisible('riskCompound')
  const showRiskCategory = isVisible('riskStats') || isVisible('avgDay') || isVisible('rMultiple') || isVisible('rolling') || isVisible('durationProfit') || isVisible('holdTimeSweetSpot')
  const showTimeCategory = isVisible('bestWorstHour') || isVisible('bestWorstWeekday') || isVisible('heatmap') || isVisible('tradeDistribution')
  const showMarketCategory = isVisible('symbols') || isVisible('sessions') || isVisible('matrix') || isVisible('longShort') || isVisible('symbolMetrics')
  const showDisciplineCategory = isVisible('checklistDiscipline') || isVisible('habitsDiscipline')

  return (
    <div>
      <SectionHeader
        eyebrow="Analytics"
        title="Performance Analytics"
        subtitle={`Métricas profundas sobre tu trading.${selectedAccountName ? ` · Cuenta: ${selectedAccountName}` : ''}`}
      />

      {/* ===== FILTROS ===== */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mb-8">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mr-1">Activo</span>
          <InstrumentDropdown
            value={instrumentFilter}
            onChange={v => setInstrumentFilter(v as InstrumentType | 'all')}
            options={instrumentOptions}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mr-1">Cuenta</span>
          <Dropdown
            value={accountFilter}
            onChange={setAccountFilter}
            options={[
              { value: 'all', label: 'Todas las cuentas' },
              ...relevantAccounts.map(a => ({ value: a.id, label: a.name })),
            ]}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mr-1">Estrategia</span>
          <Dropdown
            value={strategyFilter}
            onChange={setStrategyFilter}
            options={[
              { value: 'all', label: 'Todas las estrategias' },
              ...strategies.map(s => ({ value: s.id, label: s.name })),
            ]}
          />
        </div>
        <div className="ml-auto">
          <ColumnsDropdown
            groups={SECTION_GROUPS}
            selected={visibleSections}
            onToggle={toggleSection}
          />
        </div>
      </div>

      {filtered.length === 0 && (
        <Card className="p-6 mb-6">
          <p className="text-sm text-ink-900/40 dark:text-bone-100/40">No hay operaciones que coincidan con los filtros seleccionados.</p>
        </Card>
      )}

      <div className="space-y-8">
        {showPerformanceCategory && (
          <section>
            <CategoryTitle>Rendimiento</CategoryTitle>
            <div className="space-y-6">
              {isVisible('summary') && (
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

              <div className="grid md:grid-cols-2 gap-6">
              {isVisible('summary') && (
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <div className="flex items-center">
                      <h3 className="serif text-xl font-semibold">Desglose del Performance Score</h3>
                      <InfoTooltip text="Muestra de qué se compone tu Performance Score de Nova: Win Rate (40 pts), Profit Factor (40 pts) y Consistencia -- días operados (20 pts). El mismo score que ves en Overview, pero explicado." />
                    </div>
                    <span className="text-2xl font-bold tabular-nums">{scoreBreakdown.total}<span className="text-sm text-ink-900/40 dark:text-bone-100/40">/100</span></span>
                  </div>
                  <div className="space-y-4">
                    {[
                      { label: 'Win Rate', score: scoreBreakdown.winRateScore, max: scoreBreakdown.winRateMax, sub: `${metrics.winRate}% de aciertos` },
                      { label: 'Profit Factor', score: scoreBreakdown.profitFactorScore, max: scoreBreakdown.profitFactorMax, sub: metrics.profitFactor === Infinity ? 'Sin pérdidas registradas' : `Ratio ${metrics.profitFactor.toFixed(2)}` },
                      { label: 'Consistencia', score: scoreBreakdown.consistencyScore, max: scoreBreakdown.consistencyMax, sub: `${metrics.tradingDays} días operados (de 20 para el máximo)` },
                    ].map(item => (
                      <div key={item.label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium">{item.label}</span>
                          <span className="text-sm font-semibold tabular-nums">{item.score.toFixed(1)}/{item.max}</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-black/5 dark:bg-white/5">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (item.score / item.max) * 100)}%` }} />
                        </div>
                        <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mt-1">{item.sub}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {isVisible('riskCompound') && (
                <Card className="p-6">
                  <div className="flex items-center mb-6">
                    <h3 className="serif text-xl font-semibold">Balance & Rachas</h3>
                    <InfoTooltip text="Resumen de tu curva de equity (punto más alto alcanzado, caída desde ese pico) junto con tu racha actual de operaciones ganadoras o perdedoras consecutivas." />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    <StatCard label="Equity Actual" value={fmt(metrics.currentEquity)} positive={metrics.currentEquity >= 0} />
                    <StatCard label="Equity Máximo" value={fmt(highestEquity)} positive />
                    <StatCard label="Max Drawdown" value={fmt(maxDD)} positive={false} />
                  </div>

                  {underwaterCurve.length === 0 ? (
                    <p className="text-sm text-ink-900/40 dark:text-bone-100/40 mb-6">Aún no hay datos suficientes para la curva de drawdown.</p>
                  ) : (
                    <div className="mb-6">
                      <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-2">Underwater Drawdown Curve</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={underwaterCurve}>
                          <defs>
                            <linearGradient id="underwaterGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgb(var(--c-loss))" stopOpacity={0} />
                              <stop offset="100%" stopColor="rgb(var(--c-loss))" stopOpacity={0.35} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={axisColor} strokeOpacity={0.18} vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                          <Tooltip
                            formatter={(value: any) => [fmt(Number(value)), 'Drawdown']}
                            contentStyle={{
                              background: isDark ? '#14120F' : '#FFFFFF',
                              border: `1px solid ${isDark ? '#2A2620' : '#E7E5E4'}`,
                              borderRadius: 12,
                              fontSize: 12,
                              color: isDark ? '#F5F1E8' : '#0B0A08',
                            }}
                            labelStyle={{ color: axisColor, marginBottom: 2 }}
                          />
                          <Area type="monotone" dataKey="drawdown" stroke="rgb(var(--c-loss))" strokeWidth={2} fill="url(#underwaterGradient)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div>
                    <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-3">Rachas</p>
                    <div className="flex items-center gap-6 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          streaks.currentStreakType === 'win' ? 'bg-profit/10 text-profit' :
                          streaks.currentStreakType === 'loss' ? 'bg-loss/10 text-loss' :
                          'bg-black/5 dark:bg-white/5 text-ink-900/40 dark:text-bone-100/40'
                        }`}>
                          {streaks.currentStreakType === 'win' ? <Flame size={22} /> : streaks.currentStreakType === 'loss' ? <Snowflake size={22} /> : <Flame size={22} />}
                        </div>
                        <div>
                          <p className="text-2xl font-bold tabular-nums">{streaks.currentStreak}</p>
                          <p className="text-xs text-ink-900/40 dark:text-bone-100/40">
                            {streaks.currentStreakType === 'win' ? 'Victorias seguidas' : streaks.currentStreakType === 'loss' ? 'Pérdidas seguidas' : 'Sin racha activa'}
                          </p>
                        </div>
                      </div>
                      <div className="h-10 w-px bg-black/10 dark:bg-white/10" />
                      <div>
                        <p className="text-lg font-semibold tabular-nums text-profit">{streaks.longestWinStreak}</p>
                        <p className="text-xs text-ink-900/40 dark:text-bone-100/40">Racha ganadora más larga</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold tabular-nums text-loss">{streaks.longestLossStreak}</p>
                        <p className="text-xs text-ink-900/40 dark:text-bone-100/40">Racha perdedora más larga</p>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
              </div>
            </div>
          </section>
        )}

        {showRiskCategory && (
          <section>
            <CategoryTitle>Riesgo</CategoryTitle>
            <div className="space-y-6">
              {isVisible('riskStats') && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <StatCard label="Max Drawdown" value={fmt(maxDD)} positive={false} />
                  <StatCard label="Tamaño posición medio" value={filtered.length ? (filtered.reduce((a, t) => a + t.position_size, 0) / filtered.length).toFixed(1) : '—'} />
                  <StatCard label="Avg Win" value={fmt(avgWin)} positive />
                  <StatCard label="Avg Loss" value={fmt(avgLoss)} positive={false} />
                  <StatCard label="W/L Ratio" value={avgLoss !== 0 ? Math.abs(avgWin / avgLoss).toFixed(2) : '∞'} />
                  <StatCard label="Breakevens" value={String(metrics.breakevens)} />
                  <StatCard label="Desv. Estándar (diaria)" value={fmt(stdDevSharpe.stdDev)} />
                  <StatCard label="Sharpe Ratio" value={stdDevSharpe.sharpe.toFixed(2)} positive={stdDevSharpe.sharpe >= 0} />
                </div>
              )}

              {isVisible('avgDay') && (
                <div className="grid grid-cols-2 gap-4">
                  <StatCard
                    label="Avg Winning Day"
                    value={fmt(avgDayWinLoss.avgWinDay)}
                    sub={`${avgDayWinLoss.winDaysCount} días`}
                    positive
                  />
                  <StatCard
                    label="Avg Losing Day"
                    value={fmt(avgDayWinLoss.avgLossDay)}
                    sub={`${avgDayWinLoss.lossDaysCount} días`}
                    positive={false}
                  />
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
              {isVisible('rMultiple') && (
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

              {isVisible('rolling') && (
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <h3 className="serif text-xl font-semibold">Rolling Metrics</h3>
                    <div className="flex gap-2">
                      {ROLLING_WINDOWS.map(w => (
                        <ChipButton key={w} active={rollingWindow === w} onClick={() => setRollingWindow(w)}>
                          {w}
                        </ChipButton>
                      ))}
                    </div>
                  </div>
                  {rollingPoints.length === 0 ? (
                    <p className="text-sm text-ink-900/40 dark:text-bone-100/40">
                      Necesitas al menos {rollingWindow} operaciones para calcular esta métrica (tienes {filtered.length}).
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={rollingPoints}>
                        <CartesianGrid strokeDasharray="3 3" stroke={axisColor} strokeOpacity={0.18} vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                        <Tooltip
                          formatter={(value: any, name: string) => [fmt(Number(value)), name]}
                          contentStyle={{
                            background: isDark ? '#14120F' : '#FFFFFF',
                            border: `1px solid ${isDark ? '#2A2620' : '#E7E5E4'}`,
                            borderRadius: 12,
                            fontSize: 12,
                            color: isDark ? '#F5F1E8' : '#0B0A08',
                          }}
                          labelStyle={{ color: axisColor, marginBottom: 2 }}
                        />
                        <Line yAxisId="left" type="monotone" dataKey="rollingPnl" name="P&L acumulado" stroke="rgb(var(--c-profit))" strokeWidth={2} dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="rollingExpectancy" name="Expectancy" stroke="rgb(var(--c-accent))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </Card>
              )}
            </div>

              <div className="grid md:grid-cols-2 gap-6">
              {isVisible('durationProfit') && (
                <Card className="p-6">
                  <div className="flex items-center mb-6">
                    <h3 className="serif text-xl font-semibold">Duration vs Profit</h3>
                    <InfoTooltip text="Relaciona el tiempo que mantienes abierta cada operación con su resultado. Te ayuda a detectar si cerrar demasiado pronto, o alargar demasiado el trade, perjudica tu rentabilidad." />
                  </div>
                  {durationProfitData.points.length === 0 ? (
                    <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no hay datos suficientes.</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={280}>
                        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={axisColor} strokeOpacity={0.18} />
                          <XAxis type="number" dataKey="duration" name="Duración" tickFormatter={formatDurationTick} tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                          <YAxis type="number" dataKey="pnl" name="P&L" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                          <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            formatter={(value: any, name: string) => name === 'Duración' ? [formatDurationTick(Number(value)), name] : [fmt(Number(value)), name]}
                            contentStyle={{
                              background: isDark ? '#14120F' : '#FFFFFF',
                              border: `1px solid ${isDark ? '#2A2620' : '#E7E5E4'}`,
                              borderRadius: 12,
                              fontSize: 12,
                              color: isDark ? '#F5F1E8' : '#0B0A08',
                            }}
                            labelStyle={{ color: axisColor, marginBottom: 2 }}
                          />
                          <Scatter data={durationProfitData.points}>
                            {durationProfitData.points.map((p, i) => (
                              <Cell key={i} fill={p.pnl >= 0 ? 'rgb(var(--c-profit))' : 'rgb(var(--c-loss))'} />
                            ))}
                          </Scatter>
                        </ScatterChart>
                      </ResponsiveContainer>
                      {durationProfitData.excluded > 0 && (
                        <p className="text-[11px] text-ink-900/40 dark:text-bone-100/40 mt-3">
                          {durationProfitData.excluded} operación(es) excluida(s) por duración fuera de rango (revisa sus fechas de entrada/salida).
                        </p>
                      )}
                    </>
                  )}
                </Card>
              )}

              {isVisible('holdTimeSweetSpot') && (
                <RankedTableCard
                  title="Hold Time Sweet Spot"
                  info="Agrupa tus operaciones por el tiempo que las mantuviste abiertas. Te ayuda a identificar en qué rango de duración obtienes mejor P&L total y mejor win rate."
                  items={holdTimeItems}
                />
              )}
            </div>
            </div>
          </section>
        )}

        {showTimeCategory && (
          <section>
            <CategoryTitle>Horarios</CategoryTitle>
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
              {isVisible('bestWorstHour') && (
                <RankedTableCard
                  title="Mejor / peor hora"
                  items={hourItems}
                  scrollHeight={400}
                  right={
                    <div className="flex gap-2">
                      <ChipButton active={hourField === 'entry'} onClick={() => setHourField('entry')}>Entrada</ChipButton>
                      <ChipButton active={hourField === 'exit'} onClick={() => setHourField('exit')}>Salida</ChipButton>
                    </div>
                  }
                />
              )}

              {isVisible('bestWorstWeekday') && (
                <RankedTableCard title="Mejor / peor día de la semana" items={weekdayItems} scrollHeight={400} />
              )}
              </div>

              {isVisible('heatmap') && (
                <Card className="p-6">
                  <h3 className="serif text-xl font-semibold mb-6">Frecuencia y rendimiento por día y hora</h3>
                  {heatmapCells.every(c => c.count === 0) ? (
                    <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no hay datos suficientes.</p>
                  ) : (
                    <HeatmapGrid cells={heatmapCells} />
                  )}
                </Card>
              )}

              <div className="grid md:grid-cols-2 gap-6">
              {isVisible('monthlyProfit') && (
                <Card className="p-6">
                  <div className="flex items-center mb-6">
                    <h3 className="serif text-xl font-semibold">Monthly Profit</h3>
                    <InfoTooltip text="Muestra tu P&L neto agrupado por mes, para detectar rachas de buenos o malos meses a lo largo del tiempo." />
                  </div>
                  {monthlyProfitData.length === 0 ? (
                    <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no hay datos suficientes.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={monthlyProfitData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={axisColor} strokeOpacity={0.18} vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                        <Tooltip
                          formatter={(value: any) => [fmt(Number(value)), 'P&L']}
                          contentStyle={{
                            background: isDark ? '#14120F' : '#FFFFFF',
                            border: `1px solid ${isDark ? '#2A2620' : '#E7E5E4'}`,
                            borderRadius: 12,
                            fontSize: 12,
                            color: isDark ? '#F5F1E8' : '#0B0A08',
                          }}
                          labelStyle={{ color: axisColor, marginBottom: 2 }}
                        />
                        <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                          {monthlyProfitData.map((m, i) => (
                            <Cell key={i} fill={m.pnl >= 0 ? 'rgb(var(--c-profit))' : 'rgb(var(--c-loss))'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>
              )}

              {isVisible('tradeDistribution') && (
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <h3 className="serif text-xl font-semibold flex items-center">
                      Trade Distribution
                      <InfoTooltip text="Muestra cuántas operaciones realizas en cada hora del día (frecuencia, no rendimiento). Útil para ver en qué franjas horarias concentras tu actividad." />
                    </h3>
                    <div className="flex gap-2">
                      <ChipButton active={distributionField === 'entry'} onClick={() => setDistributionField('entry')}>Entrada</ChipButton>
                      <ChipButton active={distributionField === 'exit'} onClick={() => setDistributionField('exit')}>Salida</ChipButton>
                    </div>
                  </div>
                  {tradeDistributionData.every(d => d.count === 0) ? (
                    <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no hay datos suficientes.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={tradeDistributionData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={axisColor} strokeOpacity={0.18} vertical={false} />
                        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} interval={3} />
                        <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip
                          formatter={(value: any) => [value, 'Operaciones']}
                          contentStyle={{
                            background: isDark ? '#14120F' : '#FFFFFF',
                            border: `1px solid ${isDark ? '#2A2620' : '#E7E5E4'}`,
                            borderRadius: 12,
                            fontSize: 12,
                            color: isDark ? '#F5F1E8' : '#0B0A08',
                          }}
                          labelStyle={{ color: axisColor, marginBottom: 2 }}
                        />
                        <Bar dataKey="count" fill="rgb(var(--c-accent))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>
              )}
              </div>
            </div>
          </section>
        )}

        {showMarketCategory && (
          <section>
            <CategoryTitle>Mercados</CategoryTitle>
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
              {isVisible('symbols') && (
                <RankedTableCard title="Símbolos operados" items={symbolItems} />
              )}

              {isVisible('symbolMetrics') && (
                <Card className="p-6">
                  <div className="flex items-center mb-6">
                    <h3 className="serif text-xl font-semibold">Symbol Metrics</h3>
                    <InfoTooltip text="Reparto del número de operaciones entre los símbolos que operas, para ver de un vistazo dónde concentras tu actividad." />
                  </div>
                  {symbolMetricsData.length === 0 ? (
                    <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no hay datos suficientes.</p>
                  ) : (
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      <ResponsiveContainer width="100%" height={220} className="md:max-w-[220px]">
                        <PieChart>
                          <Pie data={symbolMetricsData} dataKey="count" nameKey="symbol" innerRadius={55} outerRadius={85} paddingAngle={2}>
                            {symbolMetricsData.map((_, i) => (
                              <Cell key={i} fill={SYMBOL_DONUT_COLORS[i % SYMBOL_DONUT_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: any, _name: any, props: any) => [`${value} trades`, props.payload.symbol]}
                            contentStyle={{
                              background: isDark ? '#14120F' : '#FFFFFF',
                              border: `1px solid ${isDark ? '#2A2620' : '#E7E5E4'}`,
                              borderRadius: 12,
                              fontSize: 12,
                              color: isDark ? '#F5F1E8' : '#0B0A08',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 w-full space-y-2">
                        {symbolMetricsData.map((s, i) => (
                          <div key={s.symbol} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: SYMBOL_DONUT_COLORS[i % SYMBOL_DONUT_COLORS.length] }} />
                              {s.symbol}
                            </span>
                            <span className="text-ink-900/50 dark:text-bone-100/50 tabular-nums">{s.count} ({s.pct}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              )}
              </div>

              {isVisible('matrix') && (
                <Card className="p-6">
                  <h3 className="serif text-xl font-semibold mb-6">Matriz símbolo × sesión</h3>
                  <MatrixTable rows={matrixRows} cols={matrixCols} cells={matrixCells} />
                </Card>
              )}

              <div className="grid md:grid-cols-2 gap-6">
              {isVisible('sessions') && (
                <RankedTableCard title="Rendimiento por sesión" items={sessionItems} />
              )}

              {isVisible('longShort') && (
                <Card className="p-6">
                  <h3 className="serif text-xl font-semibold mb-6">Long vs Short por sesión</h3>
                  {directionBySession.length === 0 ? (
                    <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no hay datos suficientes.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase text-ink-900/40 dark:text-bone-100/40 border-b border-black/5 dark:border-white/5">
                          <th className="py-2">Sesión</th>
                          <th className="py-2 text-right">Long P&L</th>
                          <th className="py-2 text-right">Long WR</th>
                          <th className="py-2 text-right">Short P&L</th>
                          <th className="py-2 text-right">Short WR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {directionBySession.map(d => (
                          <tr key={d.session} className="border-b border-black/5 dark:border-white/5 last:border-0">
                            <td className="py-2 font-medium">{shortSessionLabel(d.session)}</td>
                            <td className={`py-2 text-right font-semibold ${d.long.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                              {d.long.count ? fmt(d.long.pnl) : '—'}
                            </td>
                            <td className="py-2 text-right text-ink-900/50 dark:text-bone-100/50">
                              {d.long.count ? `${d.long.winRate}%` : '—'}
                            </td>
                            <td className={`py-2 text-right font-semibold ${d.short.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                              {d.short.count ? fmt(d.short.pnl) : '—'}
                            </td>
                            <td className="py-2 text-right text-ink-900/50 dark:text-bone-100/50">
                              {d.short.count ? `${d.short.winRate}%` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>
              )}
              </div>
            </div>
          </section>
        )}

        {showDisciplineCategory && (
          <section>
            <CategoryTitle>Disciplina</CategoryTitle>
            <div className="grid md:grid-cols-2 gap-6">
              {isVisible('checklistDiscipline') && (
                <ChecklistCorrelationCard checklistCorrelation={checklistCorrelation} />
              )}
              {isVisible('habitsDiscipline') && (
                <HabitsCorrelationCard ruleCorrelations={ruleCorrelations} />
              )}
            </div>
          </section>
        )}

        {visibleSections.size === 0 && (
          <Card className="p-6">
            <p className="text-sm text-ink-900/40 dark:text-bone-100/40">
              No hay secciones seleccionadas. Usa "Personalizar vista" para mostrar alguna.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
