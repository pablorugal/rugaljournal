import { useState } from 'react'
import { useAppData } from '../contexts'
import { toISODate } from '../utils'
import { Card, SectionHeader } from '../components/ui'

export default function HabitsPage() {
  const { habitRules, addHabitRule, habitLogs, toggleHabitLog } = useAppData()
  const [text, setText] = useState('')
  const today = toISODate(new Date())
  const checkedCount = habitRules.filter(r => habitLogs.find(l => l.rule_id === r.id && l.date === today)?.checked).length
  const pct = habitRules.length ? Math.round((checkedCount / habitRules.length) * 100) : 0
  const add = () => { if (!text.trim()) return; addHabitRule({ id: crypto.randomUUID(), text: text.trim(), created_at: new Date().toISOString() }); setText('') }
  return (
    <div>
      <SectionHeader eyebrow="Herramientas" title="Hábitos" subtitle={new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-2"><p className="text-sm font-medium">Progreso de hoy</p><p className="text-sm font-semibold">{checkedCount}/{habitRules.length}</p></div>
        <div className="h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
      </Card>
      <Card className="p-6">
        <h3 className="serif text-xl font-semibold mb-1">Mis Reglas de Trading</h3>
        <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mb-4">Marca las reglas que seguiste hoy</p>
        {habitRules.length === 0 ? <p className="text-sm text-ink-900/40 dark:text-bone-100/40 mb-4">No tienes reglas configuradas.</p> : (
          <div className="space-y-2 mb-4">
            {habitRules.map(r => {
              const checked = habitLogs.find(l => l.rule_id === r.id && l.date === today)?.checked || false
              return (<label key={r.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                <input type="checkbox" checked={checked} onChange={() => toggleHabitLog(r.id, today)} className="w-4 h-4 accent-accent" />
                <span className={`text-sm ${checked ? 'line-through text-ink-900/40 dark:text-bone-100/40' : ''}`}>{r.text}</span>
              </label>)
            })}
          </div>
        )}
        <div className="flex gap-2">
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Nueva regla de trading..." className="flex-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm" />
          <button onClick={add} className="px-4 rounded-lg bg-accent text-white text-sm font-semibold">+</button>
        </div>
      </Card>
    </div>
  )
}