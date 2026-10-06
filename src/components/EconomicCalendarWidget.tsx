import React, { useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { Card } from './ui'
import { Dropdown, ColumnsDropdown, type DropdownOption, type CheckboxGroup } from './Filters'

const EYEBROW = 'font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-ink-900/40 dark:text-bone-100/40'

interface EconomicEvent {
  id: string
  title: string
  country: string
  impact: 'High' | 'Medium' | 'Low' | 'Holiday' | 'Unknown'
  forecast: string | null
  previous: string | null
  url: string
  dateTimeUTC: string | null
  rawDate: string
  rawTime: string
}

interface CalendarDoc {
  generatedAt: string
  events: EconomicEvent[]
}

const TZ_KEY = 'tj_econ_calendar_tz_v1'
const FILTERS_KEY = 'tj_econ_calendar_filters_v1'

const TIMEZONE_OPTIONS: DropdownOption[] = [
  { value: 'Europe/Madrid', label: 'Madrid' },
  { value: 'Europe/London', label: 'Londres' },
  { value: 'America/New_York', label: 'Nueva York' },
  { value: 'Asia/Tokyo', label: 'Tokio' },
]

const COUNTRY_OPTIONS: { value: string; label: string }[] = [
  { value: 'All', label: 'Global' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'JPY', label: 'JPY' },
  { value: 'AUD', label: 'AUD' },
  { value: 'NZD', label: 'NZD' },
  { value: 'CAD', label: 'CAD' },
  { value: 'CHF', label: 'CHF' },
  { value: 'CNY', label: 'CNY' },
]

const IMPACT_OPTIONS: { value: string; label: string }[] = [
  { value: 'High', label: 'Alto' },
  { value: 'Medium', label: 'Medio' },
  { value: 'Low', label: 'Bajo' },
  { value: 'Holiday', label: 'Festivo' },
]

const IMPACT_LABELS: Record<string, string> = Object.fromEntries(
  IMPACT_OPTIONS.map(o => [o.value, o.label])
)

const FILTER_GROUPS: CheckboxGroup[] = [
  { label: 'Divisa', options: COUNTRY_OPTIONS },
  { label: 'Impacto', options: IMPACT_OPTIONS },
]

const ALL_FILTER_VALUES = [
  ...COUNTRY_OPTIONS.map(o => o.value),
  ...IMPACT_OPTIONS.map(o => o.value),
]

function loadSelectedFilters(): Set<string> {
  try {
    const raw = localStorage.getItem(FILTERS_KEY)
    if (!raw) return new Set(ALL_FILTER_VALUES)
    const arr = JSON.parse(raw) as string[]
    return new Set(arr.length ? arr : ALL_FILTER_VALUES)
  } catch {
    return new Set(ALL_FILTER_VALUES)
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function impactBadgeClasses(impact: string): string {
  switch (impact) {
    case 'High':
      return 'bg-loss/10 text-loss'
    case 'Medium':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    case 'Low':
      return 'bg-black/5 text-ink-900/50 dark:bg-white/5 dark:text-bone-100/50'
    case 'Holiday':
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
    default:
      return 'bg-black/5 text-ink-900/40 dark:bg-white/5 dark:text-bone-100/40'
  }
}

export function EconomicCalendarWidget() {
  const [events, setEvents] = useState<EconomicEvent[]>([])
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [tz, setTz] = useState<string>(() => localStorage.getItem(TZ_KEY) || 'Europe/Madrid')
  const [selected, setSelected] = useState<Set<string>>(() => loadSelectedFilters())

  useEffect(() => {
    const ref = doc(db, 'economicCalendar', 'latest')
    const unsub = onSnapshot(
      ref,
      snap => {
        if (snap.exists()) {
          const data = snap.data() as CalendarDoc
          setEvents(data.events ?? [])
          setGeneratedAt(data.generatedAt ?? null)
        } else {
          setEvents([])
          setGeneratedAt(null)
        }
        setLoading(false)
      },
      err => {
        console.error('Error cargando calendario económico:', err)
        setError(true)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  const handleTzChange = (v: string) => {
    setTz(v)
    localStorage.setItem(TZ_KEY, v)
  }

  const toggleFilter = (value: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      localStorage.setItem(FILTERS_KEY, JSON.stringify([...next]))
      return next
    })
  }

  const dayKeyFormatter = useMemo(
    () => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }),
    [tz]
  )
  const dayLabelFormatter = useMemo(
    () => new Intl.DateTimeFormat('es-ES', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }),
    [tz]
  )
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat('es-ES', { timeZone: tz, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }),
    [tz]
  )

  const filtered = useMemo(
    () => events.filter(e => selected.has(e.country) && selected.has(e.impact)),
    [events, selected]
  )

  const grouped = useMemo(() => {
    const map = new Map<string, EconomicEvent[]>()
    for (const ev of filtered) {
      if (!ev.dateTimeUTC) continue
      const key = dayKeyFormatter.format(new Date(ev.dateTimeUTC))
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ev)
    }
    const keys = [...map.keys()].sort()
    return keys.map(key => {
      const dayEvents = map.get(key)!.sort(
        (a, b) => new Date(a.dateTimeUTC!).getTime() - new Date(b.dateTimeUTC!).getTime()
      )
      return {
        key,
        label: capitalize(dayLabelFormatter.format(new Date(dayEvents[0].dateTimeUTC!))),
        events: dayEvents,
      }
    })
  }, [filtered, dayKeyFormatter, dayLabelFormatter])

  const updatedLabel = useMemo(() => {
    if (!generatedAt) return null
    const diffMin = Math.max(0, Math.round((Date.now() - new Date(generatedAt).getTime()) / 60000))
    if (diffMin < 1) return 'Actualizado justo ahora'
    if (diffMin === 1) return 'Actualizado hace 1 min'
    if (diffMin < 60) return `Actualizado hace ${diffMin} min`
    return `Actualizado hace ${Math.round(diffMin / 60)}h`
  }, [generatedAt])

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <p className={EYEBROW}>Forex Factory · Semana en curso</p>
          <h3 className="text-sm font-bold tracking-tight mt-0.5">Calendario Económico</h3>
          {updatedLabel && (
            <p className="text-[10px] text-ink-900/40 dark:text-bone-100/40 mt-0.5">{updatedLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Dropdown
            value={tz}
            onChange={handleTzChange}
            options={TIMEZONE_OPTIONS}
            align="right"
            widthClass="w-36"
          />
          <ColumnsDropdown
            groups={FILTER_GROUPS}
            selected={selected}
            onToggle={toggleFilter}
            label="Filtrar"
          />
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto -mx-2 px-2">
        {loading ? (
          <p className="text-xs text-ink-900/40 dark:text-bone-100/40 py-6 text-center">
            Cargando calendario económico...
          </p>
        ) : error ? (
          <p className="text-xs text-loss py-6 text-center">
            No se pudo cargar el calendario económico.
          </p>
        ) : grouped.length === 0 ? (
          <p className="text-xs text-ink-900/40 dark:text-bone-100/40 py-6 text-center">
            No hay eventos que coincidan con los filtros seleccionados.
          </p>
        ) : (
          grouped.map(group => (
            <div key={group.key} className="mb-2">
              <div className="sticky top-0 bg-white dark:bg-ink-800 px-2 py-1 z-10">
                <p className="text-[10px] font-bold uppercase tracking-wide text-accent">{group.label}</p>
              </div>
              <div className="space-y-0">
                {group.events.map(ev => (
                  <div
                    key={ev.id}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition"
                  >
                    <span className="w-9 shrink-0 text-[10px] font-mono tabular-nums text-ink-900/50 dark:text-bone-100/50">
                      {ev.dateTimeUTC ? timeFormatter.format(new Date(ev.dateTimeUTC)) : '--:--'}
                    </span>
                    <span
                      className={`shrink-0 px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wide ${impactBadgeClasses(ev.impact)}`}
                    >
                      {IMPACT_LABELS[ev.impact] ?? ev.impact}
                    </span>
                    <span className="shrink-0 w-8 text-[10px] font-semibold text-ink-900/60 dark:text-bone-100/60">
                      {ev.country}
                    </span>
                    <span className="flex-1 text-xs font-medium truncate">{ev.title}</span>
                    <span className="shrink-0 text-[10px] tabular-nums text-right w-24">
                      {ev.forecast || ev.previous ? (
                        <>
                          <span className="text-ink-900/40 dark:text-bone-100/40">P: </span>
                          <span className="font-semibold">{ev.previous ?? '—'}</span>
                        </>
                      ) : (
                        <span className="text-ink-900/20 dark:text-bone-100/20">—</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
