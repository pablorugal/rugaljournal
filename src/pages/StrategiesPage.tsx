import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useAppData } from '../contexts'
import { Card, SectionHeader, Modal, Field, inputCls } from '../components/ui'

export default function StrategiesPage() {
  const { strategies, addStrategy, trades } = useAppData()
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rules, setRules] = useState('')

  const resetForm = () => { setName(''); setDescription(''); setRules('') }

  const create = () => {
    if (!name.trim()) return
    addStrategy({
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim() || undefined,
      rules: rules.trim() || undefined,
      created_at: new Date().toISOString(),
    })
    resetForm()
    setShowModal(false)
  }

  const perf = strategies.map(s => {
    const st = trades.filter(t => t.strategy_id === s.id)
    const wins = st.filter(t => t.pnl > 0).length
    return { ...s, count: st.length, wins, pnl: st.reduce((a, t) => a + t.pnl, 0) }
  })

  return (
    <div>
      <SectionHeader eyebrow="Playbook" title="Estrategias" subtitle="Tu librería de setups y su rendimiento real."
        right={
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light">
            <Plus size={16} /> Nueva estrategia
          </button>
        } />

      <div className="mb-8">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-3">Mis estrategias</h3>
        {strategies.length === 0 ? (
          <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no has creado ninguna estrategia. Crea la primera para empezar a etiquetar tus trades.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {strategies.map(s => (
              <Card key={s.id} className="p-5">
                <h4 className="font-semibold mb-1">{s.name}</h4>
                <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mb-3">{s.description || 'Sin descripción todavía.'}</p>
                {s.rules && (
                  <div className="text-xs text-ink-900/60 dark:text-bone-100/60 whitespace-pre-wrap border-t border-black/5 dark:border-white/5 pt-2 mt-2">
                    {s.rules}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-3">Rendimiento por setup</h3>
        <Card className="p-6">
          {perf.every(p => p.count === 0) ? (
            <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no has etiquetado ninguna estrategia en tus trades.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-900/40 dark:text-bone-100/40 border-b border-black/5 dark:border-white/5">
                  <th className="py-2">Setup</th><th className="py-2">Trades</th><th className="py-2">Win Rate</th><th className="py-2">P&L</th>
                </tr>
              </thead>
              <tbody>
                {perf.map(p => (
                  <tr key={p.id} className="border-b border-black/5 dark:border-white/5 last:border-0">
                    <td className="py-2 font-medium">{p.name}</td>
                    <td className="py-2">{p.count}</td>
                    <td className="py-2">{p.count ? Math.round((p.wins / p.count) * 100) : 0}%</td>
                    <td className={`py-2 font-semibold ${p.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>${p.pnl.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Modal open={showModal} onClose={() => { setShowModal(false); resetForm() }}>
        <h2 className="serif text-2xl font-semibold mb-1">Nueva estrategia</h2>
        <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-6">Define un setup con su descripción y las reglas que debes cumplir antes de operarlo.</p>
        <div className="space-y-4">
          <Field label="Nombre">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Breakout NY Open, FVG Pullback..." className={inputCls} />
          </Field>
          <Field label="Descripción">
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="¿En qué consiste y cuándo se aplica?" className={inputCls} />
          </Field>
          <Field label="Reglas / Confluencias">
            <textarea rows={5} value={rules} onChange={e => setRules(e.target.value)} placeholder={'• Estructura alcista en HTF\n• Liquidez tomada\n• Rechazo en zona clave'} className={inputCls} />
          </Field>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => { setShowModal(false); resetForm() }} className="px-5 py-2.5 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={create} className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light">Crear estrategia</button>
        </div>
      </Modal>
    </div>
  )
}