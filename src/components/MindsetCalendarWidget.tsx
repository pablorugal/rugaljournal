import React, { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { MONTHS_ES, DAYS_ES, toISODate, isSameDay, getMonthMatrix } from '../utils'
import { getMindsetDayColor } from '../calculations'
import type { MindsetEntry } from '../types'

const COLOR_DOT: Record<string, string> = {
  green: 'bg-profit',
  yellow: 'bg-amber-400',
  red: 'bg-loss',
  none: 'bg-black/10 dark:bg-white/10',
}
const COLOR_BG: Record<string, string> = {
  green: 'bg-profit/15 hover:bg-profit/25',
  yellow: 'bg-amber-400/15 hover:bg-amber-400/25',
  red: 'bg-loss/15 hover:bg-loss/25',
  none: 'hover:bg-black/5 dark:hover:bg-white/5',
}

export default function MindsetCalendarWidget({ entries, onSelectDate }: { entries: MindsetEntry[]; onSelectDate: (date: string) => void }) {
  const [open, setOpen] = useState(false)
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const year = cursor.getFullYear(), month = cursor.getMonth()
  const weeks = useMemo(() => getMonthMatrix(year, month), [year, month])

  const entryByDate = useMemo(() => {
    const map: Record<string, MindsetEntry> = {}
    entries.forEach(e => { map[e.date] = e })
    return map
  }, [entries])

  const goPrev = () => setCursor(new Date(year, month - 1, 1))
  const goNext = () => setCursor(new Date(year, month + 1, 1))

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
      >
        <CalendarDays size={16} /> Calendario
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 z-50 bg-white dark:bg-ink-800 border border-black/10 dark:border-white/10 rounded-2xl shadow-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <button onClick={goPrev} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"><ChevronLeft size={16} /></button>
              <p className="text-sm font-semibold">{MONTHS_ES[month]} {year}</p>
              <button onClick={goNext} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"><ChevronRight size={16} /></button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAYS_ES.map(d => (
                <div key={d} className="text-center text-[9px] font-semibold uppercase text-ink-900/40 dark:text-bone-100/40 py-1">{d[0]}</div>
              ))}
            </div>

            <div className="space-y-1">
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1">
                  {week.map((d, di) => {
                    const inMonth = d.getMonth() === month
                    const iso = toISODate(d)
                    const entry = entryByDate[iso]
                    const color = getMindsetDayColor(entry)
                    const isToday = isSameDay(d, today)
                    return (
                      <button
                        key={di}
                        type="button"
                        onClick={() => { onSelectDate(iso); setOpen(false) }}
                        className={`relative h-8 rounded-lg text-[11px] font-medium flex items-center justify-center transition ${inMonth ? COLOR_BG[color] : 'opacity-20'} ${isToday ? 'ring-2 ring-accent' : ''}`}
                      >
                        {d.getDate()}
                        {color !== 'none' && inMonth && (
                          <span className={`absolute bottom-0.5 w-1.5 h-1.5 rounded-full ${COLOR_DOT[color]}`} />
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-black/5 dark:border-white/5 flex-wrap">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-profit" /><span className="text-[10px] text-ink-900/50 dark:text-bone-100/50">Buen día</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-[10px] text-ink-900/50 dark:text-bone-100/50">Regular</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-loss" /><span className="text-[10px] text-ink-900/50 dark:text-bone-100/50">Mal día</span></div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}