import { useEffect, useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useAppData, useTheme } from '../contexts'
import {
  computeMetrics, computeExpectancy, computeAvgWinLoss, computeMaxDrawdown,
  filterTrades, computeByHourField, computeByWeekday, computeBySession, computeRMultipleDistribution,
  computeBySymbol, computeHeatmap, computeSymbolSessionMatrix, computeDirectionBySession,
  computeAvgDayWinLoss, computeRollingMetrics,
} from '../calculations'
import {
  Card, SectionHeader, StatCard, ChipButton,
  RankedTableCard, HeatmapGrid, MatrixTable,
  type BarRowItem, type MatrixCellData,
} from '../components/ui'
import { InstrumentDropdown, Dropdown, ColumnsDropdown, type CheckboxGroup } from '../components/Filters'
import { fmt } from '../utils'
import type { InstrumentType } from '../types'

const INSTRUMENT_FILTERS: (InstrumentType | 'all')[] = ['all', 'Futuros', 'Forex', 'Acciones', 'Crypto', 'Opciones']
const ROLLING_WINDOWS: (30 | 60 | 90)[] = [30, 60, 90]
const SESSION_ORDER_SHORT = ['Asia', 'Londres', 'Solapamiento NY-Londres', 'Nueva York', 'Fuera de sesión']

const ALL_SECTIONS = [
  'summary', 'riskStats', 'avgDay', 'rMultiple', 'rolling',
  'bestWorstHour', 'bestWorstWeekday', 'heatmap',
  'symbols', 'sessions', 'matrix', 'longShort',
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
  ]},
  { label: 'Riesgo', options: [
    { value: 'riskStats', label: 'Métricas de riesgo' },
    { value: 'avgDay', label: 'Avg Day Win/Loss' },
    { value: 'rMultiple', label: 'R-Multiple Distribution' },
    { value: 'rolling', label: 'Rolling Metrics' },
  ]},
  { label: 'Horarios', options: [
    { value: 'bestWorstHour', label: 'Mejor/peor hora' },
    { value: 'bestWorstWeekday', label: 'Mejor/peor día de semana' },
    { value: 'heatmap', label: 'Heatmap día × hora' },
  ]},
  { label: 'Mercados', options: [
    { value: 'symbols', label: 'Símbolos operados' },
    { value: 'sessions', label: 'Rendimiento por sesión' },
    { value: 'matrix', label: 'Matriz símbolo × sesión' },
    { value: 'longShort', label: 'Long vs Short por sesión' },
  ]},
]

function shortSessionLabel(label: string): string {
  const idx = label.indexOf(' (')
  return idx > -1 ? label.slice(0, idx) : label
}

function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

function CategoryTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-900/40 dark:text-bone-100/40 mb-4">
      {children}
    </h2>
  )
}

export default function AnalyticsPage() {
  const { trades, settings, strategies, accounts } = useAppData()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const axisColor = isDark ? '#A8A196' : '#78716C'
  const [strategyFilter, setStrategyFilter] = useState<string>('all')
  const [instrumentFilter, setInstrumentFilter] = useState<InstrumentType | 'all'>('all')
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [hourField, setHourField] = useState<'entry' | 'exit'>('entry')
  const [rollingWindow, setRollingWindow] = useState<30 | 60 | 90>(30)
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
  const expectancy = computeExpectancy(filtered, settings)
  const { avgWin, avgLoss } = computeAvgWinLoss(filtered, settings)
  const maxDD = computeMaxDrawdown(metrics.equityCurve)
  const avgDayWinLoss = computeAvgDayWinLoss(filtered, settings)
  const rollingPoints = computeRollingMetrics(filtered, settings, rollingWindow)

  const bySymbol = computeBySymbol(filtered, settings)
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

  const showRiskCategory = isVisible('riskStats') || isVisible('avgDay') || isVisible('rMultiple') || isVisible('rolling')
  const showTimeCategory = isVisible('bestWorstHour') || isVisible('bestWorstWeekday') || isVisible('heatmap')
  const showMarketCategory = isVisible('symbols') || isVisible('sessions') || isVisible('matrix') || isVisible('longShort')

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

      <div className="space-y-10">
        {isVisible('summary') && (
          <section>
            <CategoryTitle>Rendimiento</CategoryTitle>
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
          </section>
        )}

        {showTimeCategory && (
          <section>
            <CategoryTitle>Horarios</CategoryTitle>
            <div className="space-y-6">
              {isVisible('bestWorstHour') && (
                <RankedTableCard
                  title="Mejor / peor hora"
                  items={hourItems}
                  right={
                    <div className="flex gap-2">
                      <ChipButton active={hourField === 'entry'} onClick={() => setHourField('entry')}>Entrada</ChipButton>
                      <ChipButton active={hourField === 'exit'} onClick={() => setHourField('exit')}>Salida</ChipButton>
                    </div>
                  }
                />
              )}

              {isVisible('bestWorstWeekday') && (
                <RankedTableCard title="Mejor / peor día de la semana" items={weekdayItems} />
              )}

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
            </div>
          </section>
        )}

        {showMarketCategory && (
          <section>
            <CategoryTitle>Mercados</CategoryTitle>
            <div className="space-y-6">
              {isVisible('symbols') && (
                <RankedTableCard title="Símbolos operados" items={symbolItems} />
              )}

              {isVisible('sessions') && (
                <RankedTableCard title="Rendimiento por sesión" items={sessionItems} />
              )}

              {isVisible('matrix') && (
                <Card className="p-6">
                  <h3 className="serif text-xl font-semibold mb-6">Matriz símbolo × sesión</h3>
                  <MatrixTable rows={matrixRows} cols={matrixCols} cells={matrixCells} />
                </Card>
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
