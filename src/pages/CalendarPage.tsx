import React, { useMemo, useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppData } from '../contexts'
import { MONTHS_ES, DAYS_ES, toISODate, isSameDay, getISOWeek, getMonthMatrix, fmt } from '../utils'
import { computeMetrics } from '../calculations'
import { Card, SectionHeader, ChipButton } from '../components/ui'
import type { InstrumentType } from '../types'

const INSTRUMENT_FILTERS: ('Todos' | InstrumentType)[] = ['Todos', 'Futuros', 'Opciones', 'Forex', 'Acciones']

export default function CalendarPage() {
  const { trades, settings } = useAppData()
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const year = cursor.getFullYear(), month = cursor.getMonth()
  const weeks = useMemo(() => getMonthMatrix(year, month), [year, month])

  const [instrumentFilter, setInstrumentFilter] = useState<'Todos' | InstrumentType>('Todos')
  const [symbolFilter, setSymbolFilter] = useState<string>('Todos')

  const availableSymbols = useMemo(() => {
    const base = instrumentFilter === 'Todos' ? trades : trades.filter(t => t.instrument_type === instrumentFilter)
    return Array.from(new Set(base.map(t => t.symbol))).sort()
  }, [trades, instrumentFilter])

  useEffect(() => { setSymbolFilter('Todos') }, [instrumentFilter])

  const filteredTrades = useMemo(() => trades.filter(t => {
    if (instrumentFilter !== 'Todos' && t.instrument_type !== instrumentFilter) return false
    if (symbolFilter !== 'Todos' && t.symbol !== symbolFilter) return false
    return true
  }), [trades, instrumentFilter, symbolFilter])

  const monthTrades = useMemo(() => filteredTrades.filter(t => {
    const d = new Date(t.exit_datetime); return d.getMonth() === month && d.getFullYear() === year
  }), [filteredTrades, month, year])

  const metrics = useMemo(() => computeMetrics(monthTrades, settings), [monthTrades, settings])

  const pnlByDay = useMemo(() => {
    const map: Record<string, { pnl: number; count: number }> = {}
    filteredTrades.forEach(t => {
      const key = t.exit_datetime.slice(0, 10)
      if (!map[key]) map[key] = { pnl: 0, count: 0 }
      map[key].pnl += t.pnl; map[key].count += 1
    })
    return map
  }, [filteredTrades])

  const goToToday = () => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
  const goPrev = () => setCursor(new Date(year, month - 1, 1))
  const goNext = () => setCursor(new Date(year, month + 1, 1))

  return (
    <div>
      <SectionHeader
        eyebrow="Calendar"
        title={`${MONTHS_ES[month]} ${year}`}
        subtitle={`${metrics.tradingDays} dias activos · ${monthTrades.length} trades · Total ${fmt(metrics.netPnl)}`}
        right={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex gap-1.5 flex-wrap">
              {INSTRUMENT_FILTERS.map(f => (
                <ChipButton key={f} active={instrumentFilter === f} onClick={() => setInstrumentFilter(f)}>{f}</ChipButton>
              ))}
            </div>
            <select
              value={symbolFilter}
              onChange={e => setSymbolFilter(e.target.value)}
              className="bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm font-medium"
            >
              <option value="Todos">Todos los simbolos</option>
              {availableSymbols.map(sym => <option key={sym} value={sym}>{sym}</option>)}
            </select>
          </div>
        }
      />

      <div className="flex items-center justify-center gap-4 mb-6">
        <button onClick={goPrev} className="p-2 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"><ChevronLeft size={18} /></button>
        <button onClick={goToToday} className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">Today</button>
        <button onClick={goNext} className="p-2 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"><ChevronRight size={18} /></button>
      </div>

      <Card className="p-4 overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-8 gap-2 mb-2">
            {DAYS_ES.map(d => <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 py-2">{d}</div>)}
            <div className="text-center text-[11px] font-semibold uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 py-2">SEM</div>
          </div>
          <div className="space-y-2">
            {weeks.map((week, wi) => {
              const weekNum = getISOWeek(week[0])
              let weekPnl = 0, weekCount = 0
              week.forEach(d => { const entry = pnlByDay[toISODate(d)]; if (entry) { weekPnl += entry.pnl; weekCount += entry.count } })
              return (
                <div key={wi} className="grid grid-cols-8 gap-2">
                  {week.map((d, di) => {
                    const inMonth = d.getMonth() === month
                    const entry = pnlByDay[toISODate(d)]
                    const isToday = isSameDay(d, today)
                    return (
                      <div key={di} className={`rounded-xl p-3 min-h-[80px] flex flex-col justify-between ${!inMonth ? 'bg-black/[0.02] dark:bg-white/[0.02] text-ink-900/20 dark:text-bone-100/20' : entry ? (entry.pnl >= 0 ? 'bg-profit/10' : 'bg-loss/10') : 'bg-black/[0.03] dark:bg-white/[0.03]'} ${isToday ? 'ring-2 ring-accent' : ''}`}>
                        <span className="text-xs font-medium">{d.getDate()}</span>
                        {entry && (<div><p className={`text-sm font-semibold ${entry.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(entry.pnl)}</p><p className="text-[10px] text-ink-900/40 dark:text-bone-100/40">{entry.count} trades</p></div>)}
                      </div>
                    )
                  })}
                  <div className="rounded-xl p-3 min-h-[80px] flex flex-col justify-center items-center bg-accent/5">
                    <p className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">Sem {weekNum}</p>
                    <p className={`text-sm font-semibold ${weekPnl >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(weekPnl)}</p>
                    <p className="text-[10px] text-ink-900/40 dark:text-bone-100/40">{weekCount} trades</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Card>
    </div>
  )
}