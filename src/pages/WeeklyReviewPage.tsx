import { useState, useMemo, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppData } from '../contexts'
import { computeMetrics } from '../calculations'
import { Card, SectionHeader, StatCard, inputCls } from '../components/ui'

function startOfWeek(d: Date) { const day = (d.getDay() + 6) % 7; const res = new Date(d); res.setDate(d.getDate() - day); return res }
function weekId(d: Date) { return d.toISOString().split('T')[0] }

export default function WeeklyReviewPage() {
  const { trades, settings, weeklyReviews, upsertWeeklyReview } = useAppData()
  const [cursor, setCursor] = useState(startOfWeek(new Date()))
  const weekEnd = new Date(cursor); weekEnd.setDate(cursor.getDate() + 6)
  const id = weekId(cursor)

  const weekTrades = useMemo(() => trades.filter(t => { const d = new Date(t.exit_datetime); return d >= cursor && d <= weekEnd }), [trades, cursor])
  const metrics = computeMetrics(weekTrades, settings)

  const [note, setNote] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const existing = weeklyReviews.find(w => w.id === id)
    setNote(existing?.content ?? '')
    setSaveStatus('idle')
  }, [id])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setNote(value)
    setSaveStatus('saving')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      upsertWeeklyReview({
        id,
        content: value,
        week_start: cursor.toISOString(),
        week_end: weekEnd.toISOString(),
      })
      setSaveStatus('saved')
    }, 600)
  }

  return (
    <div>
      <SectionHeader eyebrow="Weekly Review" title="Revisión semanal" subtitle={`${cursor.toLocaleDateString()} — ${weekEnd.toLocaleDateString()}`} />
      <div className="flex items-center justify-center gap-4 mb-6">
        <button onClick={() => setCursor(new Date(cursor.getTime() - 7 * 86400000))} className="p-2 rounded-lg border border-black/10 dark:border-white/10"><ChevronLeft size={18} /></button>
        <button onClick={() => setCursor(startOfWeek(new Date()))} className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium">Esta semana</button>
        <button onClick={() => setCursor(new Date(cursor.getTime() + 7 * 86400000))} className="p-2 rounded-lg border border-black/10 dark:border-white/10"><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="P&L Semana" value={`$${metrics.netPnl.toFixed(2)}`} positive={metrics.netPnl >= 0} />
        <StatCard label="Trades" value={`${weekTrades.length}`} sub={`${metrics.wins}W / ${metrics.losses}L`} />
        <StatCard label="Win Rate" value={`${metrics.winRate}%`} />
        <StatCard label="Días Activos" value={`${metrics.tradingDays}`} />
      </div>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card className="p-5"><p className="text-xs uppercase text-ink-900/40 dark:text-bone-100/40 mb-1">Mejor día</p><p className="text-xl font-semibold text-profit">{metrics.bestDay ? `$${metrics.bestDay.pnl.toFixed(2)}` : '—'}</p></Card>
        <Card className="p-5"><p className="text-xs uppercase text-ink-900/40 dark:text-bone-100/40 mb-1">Peor día</p><p className="text-xl font-semibold text-loss">{metrics.worstDay ? `$${metrics.worstDay.pnl.toFixed(2)}` : '—'}</p></Card>
      </div>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="serif text-xl font-semibold">Diario de la semana</h3>
          {saveStatus === 'saving' && <span className="text-xs text-ink-900/40 dark:text-bone-100/40">Guardando...</span>}
          {saveStatus === 'saved' && <span className="text-xs text-profit">Guardado ✓</span>}
        </div>
        <textarea
          rows={6}
          value={note}
          onChange={handleChange}
          placeholder="¿Qué aprendiste esta semana?"
          className={inputCls}
        />
      </Card>
    </div>
  )
}