import { useState } from 'react'
import { Pencil, Trash2, Check } from 'lucide-react'
import { useAppData } from '../contexts'
import { Card, SectionHeader } from '../components/ui'

export default function ChecklistsPage() {
  const { checklists, addChecklist, updateChecklist, deleteChecklist } = useAppData()
  const [name, setName] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [itemDraft, setItemDraft] = useState<Record<string, string>>({})
  const create = () => { if (!name.trim()) return; addChecklist({ id: crypto.randomUUID(), name: name.trim(), items: [], created_at: new Date().toISOString() }); setName('') }
  const addItem = (checklistId: string) => {
    const text = itemDraft[checklistId]?.trim()
    if (!text) return
    const cl = checklists.find(c => c.id === checklistId)
    if (!cl) return
    updateChecklist(checklistId, { items: [...cl.items, { id: crypto.randomUUID(), text, checked: false }] })
    setItemDraft(prev => ({ ...prev, [checklistId]: '' }))
  }
  const toggleItem = (checklistId: string, itemId: string) => {
    const cl = checklists.find(c => c.id === checklistId)
    if (!cl) return
    updateChecklist(checklistId, { items: cl.items.map(it => it.id === itemId ? { ...it, checked: !it.checked } : it) })
  }
  return (
    <div>
      <SectionHeader eyebrow="Herramientas" title="Checklists" subtitle="Crea checklists para evaluar tus trades según las confluencias que tengan." />
      <Card className="p-6 mb-6">
        <h3 className="serif text-xl font-semibold mb-4">Mis Checklists de Confluencias</h3>
        <div className="flex gap-2 mb-6">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre de nueva checklist..." className="flex-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm" />
          <button onClick={create} className="px-4 rounded-lg bg-accent text-white text-sm font-semibold">+ Crear</button>
        </div>
        {checklists.length === 0 ? <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no tienes checklists creadas.</p> : (
          <div className="space-y-3">
            {checklists.map(cl => {
              const checkedCount = cl.items.filter(it => it.checked).length
              return (
                <div key={cl.id} className="border border-black/10 dark:border-white/10 rounded-xl">
                  <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setOpenId(openId === cl.id ? null : cl.id)}>
                    <p className="font-medium">
                      {cl.name}{' '}
                      <span className="text-xs text-ink-900/40 dark:text-bone-100/40">
                        ({checkedCount}/{cl.items.length} cumplidas)
                      </span>
                    </p>
                    <div className="flex gap-3 text-xs" onClick={e => e.stopPropagation()}>
                      <button className="flex items-center gap-1 text-ink-900/50 dark:text-bone-100/50 hover:text-accent"><Pencil size={12} /> Renombrar</button>
                      <button onClick={() => deleteChecklist(cl.id)} className="flex items-center gap-1 text-loss hover:opacity-80"><Trash2 size={12} /> Eliminar</button>
                    </div>
                  </div>
                  {openId === cl.id && (
                    <div className="p-4 pt-0 space-y-2">
                      {cl.items.map(it => (
                        <div key={it.id} className="flex items-center gap-3 py-1.5">
                          <button
                            type="button"
                            onClick={() => toggleItem(cl.id, it.id)}
                            className={`w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition ${it.checked ? 'bg-profit border-profit' : 'border-black/20 dark:border-white/20 hover:border-accent'}`}
                          >
                            {it.checked && <Check size={13} className="text-white" strokeWidth={3} />}
                          </button>
                          <p className={`text-sm ${it.checked ? 'text-ink-900/40 dark:text-bone-100/40 line-through' : 'text-ink-900/70 dark:text-bone-100/70'}`}>{it.text}</p>
                        </div>
                      ))}
                      <div className="flex gap-2 pt-2">
                        <input value={itemDraft[cl.id] || ''} onChange={e => setItemDraft(prev => ({ ...prev, [cl.id]: e.target.value }))} placeholder="Nueva confluencia..." className="flex-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm" />
                        <button onClick={() => addItem(cl.id)} className="px-4 rounded-lg bg-accent text-white text-sm font-semibold">+</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}