import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'
import { useAppData } from '../contexts'
import { MONTHS_ES, DAYS_ES, toISODate, isSameDay, getMonthMatrix } from '../utils'
import { getMindsetDayColor } from '../calculations'
import { Card, SectionHeader, Modal } from '../components/ui'
import type { MindsetEntry } from '../types'

const COLOR_BG: Record<string, string> = {
  green: 'bg-profit/15 hover:bg-profit/25 text-profit',
  yellow: 'bg-amber-400/15 hover:bg-amber-400/25 text-amber-600 dark:text-amber-400',
  red: 'bg-loss/15 hover:bg-loss/25 text-loss',
  none: 'hover:bg-black/5 dark:hover:bg-white/5',
}

function Row({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === undefined || value === null || value === '') return null
  const display = typeof value === 'boolean' ? (value ? 'Sí' : 'No') : value
  return (
    <div className="py-2 border-b border-black/5 dark:border-white/5 last:border-0">
      <p className="text-[11px] uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-0.5">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{display}</p>
    </div>
  )
}

function DayDetailModal({ entry, date, onClose }: { entry?: MindsetEntry; date: string; onClose: () => void }) {
  const label = new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const color = getMindsetDayColor(entry)
  const colorLabel = color === 'green' ? 'Buen día' : color === 'yellow' ? 'Día regular' : color === 'red' ? 'Mal día' : 'Sin datos'

  return (
    <Modal open={!!entry || !!date} onClose={onClose} widthClass="max-w-2xl">
      <div className="flex items-center justify-between mb-6 pr-8">
        <h2 className="serif text-2xl font-semibold capitalize">{label}</h2>
        {entry && (
          <span className={`text-xs font-bold uppercase px-3 py-1.5 rounded-full ${COLOR_BG[color]}`}>{colorLabel}</span>
        )}
      </div>

      {!entry ? (
        <p className="text-sm text-ink-900/40 dark:text-bone-100/40 text-center py-10">No hay registros de mindset para este día.</p>
      ) : (
        <div className="space-y-8">
          {entry.has_premarket && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-accent mb-2">Premarket</h3>
              <Row label="Estado emocional" value={entry.emotion ? `${entry.emotion}/10` : undefined} />
              <Row label="¿Más de 7h de sueño?" value={entry.slept_well} />
              <Row label="¿Carga emocional previa?" value={entry.emotional_baggage} />
              <Row label="Estado del mercado" value={entry.market_structure === 'clear' ? 'Estructura clara' : entry.market_structure === 'accumulation' ? 'Acumulación' : undefined} />
              <Row label="Bias del día" value={entry.daily_bias} />
              <Row label="¿Noticias de alto impacto?" value={entry.high_impact_news} />
              <Row label="¿Convicción con el máximo diario?" value={entry.conviction} />
              <Row label="Qué quiero demostrarme hoy" value={entry.goal_today} />
              <Row label="Plan si voy rojo" value={entry.plan_if_red} />
            </div>
          )}

          {entry.has_postsession && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-accent mb-2">Post-sesión</h3>
              <Row label="Estado emocional al cierre" value={entry.close_emotion ? `${entry.close_emotion}/10` : undefined} />
              <Row label="Cambio respecto al inicio" value={entry.change_vs_start} />
              <Row label="Estado antes del primer trade" value={entry.state_before_first_trade} />
              <Row label="¿Necesitó recuperar?" value={entry.needed_to_recover} />
              <Row label="¿Decisión que sabía incorrecta?" value={entry.wrong_decision} />
              <Row label="Emoción dominante" value={entry.dominant_emotion} />
              <Row label="Cómo influyó" value={entry.emotion_influence} />
              <Row label="¿Respetó el plan?" value={entry.followed_plan === 'yes' ? 'Sí completamente' : entry.followed_plan === 'partial' ? 'Parcialmente' : entry.followed_plan === 'no' ? 'No' : undefined} />
              <Row label="Versión que operó" value={entry.traded_version} />
              <Row label="Aprendizaje emocional" value={entry.emotional_learning} />
              <Row label="Cambio para mañana" value={entry.tomorrow_change} />
            </div>
          )}

          {!entry.has_premarket && !entry.has_postsession && (
            <p className="text-sm text-ink-900/40 dark:text-bone-100/40 text-center py-6">Registro incompleto.</p>
          )}
        </div>
      )}
    </Modal>
  )
}

export default function MindsetCalendarPage() {
  const { mindsetEntries } = useAppData()
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const year = cursor.getFullYear(), month = cursor.getMonth()
  const weeks = useMemo(() => getMonthMatrix(year, month), [year, month])

  const entryByDate = useMemo(() => {
    const map: Record<string, MindsetEntry> = {}
    mindsetEntries.forEach(e => { map[e.date] = e })
    return map
  }, [mindsetEntries])

  const goToday = () => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
  const goPrev = () => setCursor(new Date(year, month - 1, 1))
  const goNext = () => setCursor(new Date(year, month + 1, 1))

  return (
    <div>
      <SectionHeader
        eyebrow="Mindset"
        title={`${MONTHS_ES[month]} ${year}`}
        subtitle="Historial de mindset diario. Haz clic en un día para ver el detalle."
        right={
          <Link to="/mindset" className="flex items-center gap-2 px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">
            <ArrowLeft size={16} /> Volver a Mindset
          </Link>
        }
      />

      <div className="flex items-center justify-center gap-4 mb-6">
        <button onClick={goPrev} className="p-2 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"><ChevronLeft size={18} /></button>
        <button onClick={goToday} className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">Hoy</button>
        <button onClick={goNext} className="p-2 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"><ChevronRight size={18} /></button>
      </div>

      <div className="flex items-center gap-4 justify-center mb-6 flex-wrap">
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-profit" /><span className="text-xs text-ink-900/50 dark:text-bone-100/50">Buen día</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /><span className="text-xs text-ink-900/50 dark:text-bone-100/50">Regular</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-loss" /><span className="text-xs text-ink-900/50 dark:text-bone-100/50">Mal día</span></div>
      </div>

      <Card className="p-4 overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-7 gap-2 mb-2">
            {DAYS_ES.map(d => <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 py-2">{d}</div>)}
          </div>
          <div className="space-y-2">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-2">
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
                      onClick={() => setSelectedDate(iso)}
                      className={`rounded-xl p-3 min-h-[70px] flex flex-col justify-between text-left transition ${!inMonth ? 'opacity-20' : COLOR_BG[color]} ${isToday ? 'ring-2 ring-accent' : ''}`}
                    >
                      <span className="text-xs font-medium">{d.getDate()}</span>
                      {entry && (entry.has_premarket || entry.has_postsession) && (
                        <span className="text-[10px] font-medium">
                          {entry.has_premarket && entry.has_postsession ? 'Completo' : entry.has_premarket ? 'Solo AM' : 'Solo PM'}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {selectedDate && (
        <DayDetailModal date={selectedDate} entry={entryByDate[selectedDate]} onClose={() => setSelectedDate(null)} />
      )}
    </div>
  )
}