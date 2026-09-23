import React, { useMemo, useState } from 'react'
import {
  Boxes, DollarSign, Clock, BookOpen, ListChecks, Paperclip, UploadCloud, Star, ArrowUpDown,
  Pencil, Trash2, AlertTriangle,
} from 'lucide-react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase'
import { useAppData, useAuth } from '../contexts'
import { fmt } from '../utils'
import { getNetPnl, classifyTrade } from '../calculations'
import type { Trade, Direction, InstrumentType } from '../types'
import {
  Card, SectionHeader, PillTabs, Field, inputCls, DirectionToggle, Modal, StatCard, ScreenshotUploader,
  Block, MiniMetric,
} from '../components/ui'

/* ==================== SHARED ==================== */
const emptyForm = {
  symbol: '', instrument_type: 'Futuros' as InstrumentType, direction: 'long' as Direction,
  entry_price: '', exit_price: '', position_size: '', pnl: '', risk_amount: '', stop_loss: '', take_profit: '',
  entry_datetime: '', exit_datetime: '', strategy_id: '', custom_setup: '', checklist_id: '', rating: 0, notes: '',
}
function tradeToForm(t: Trade) {
  return {
    symbol: t.symbol,
    instrument_type: t.instrument_type,
    direction: t.direction,
    entry_price: String(t.entry_price ?? ''),
    exit_price: String(t.exit_price ?? ''),
    position_size: String(t.position_size ?? ''),
    pnl: String(t.pnl ?? ''),
    risk_amount: t.risk_amount !== undefined ? String(t.risk_amount) : '',
    stop_loss: t.stop_loss !== undefined ? String(t.stop_loss) : '',
    take_profit: t.take_profit !== undefined ? String(t.take_profit) : '',
    entry_datetime: t.entry_datetime ? t.entry_datetime.slice(0, 16) : '',
    exit_datetime: t.exit_datetime ? t.exit_datetime.slice(0, 16) : '',
    strategy_id: t.strategy_id || '',
    custom_setup: t.custom_setup || '',
    checklist_id: t.checklist_id || '',
    rating: t.rating || 0,
    notes: t.notes || '',
  }
}

/* ==================== TRADE FORM (Nuevo Trade) ==================== */
function TradeForm({ onSaved }: { onSaved: () => void }) {
  const { strategies, addStrategy, checklists, addTrade } = useAppData()
  const { user } = useAuth()
  const [form, setForm] = useState(emptyForm)
  const [useFreeSetup, setUseFreeSetup] = useState(false)
  const [newStrategyName, setNewStrategyName] = useState('')
  const [showNewStrategy, setShowNewStrategy] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)

  const set = (key: keyof typeof form) => (e: any) => {
    const value = e?.target ? e.target.value : e
    setForm(prev => ({ ...prev, [key]: value }))
  }
  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return
    const valid = Array.from(fileList).filter(f => f.size <= 5 * 1024 * 1024 && /image\/(png|jpe?g)/.test(f.type))
    setFiles(prev => [...prev, ...valid])
  }
  const clearForm = () => { setForm(emptyForm); setFiles([]); setUseFreeSetup(false) }
  const handleCreateStrategy = () => {
    if (!newStrategyName.trim()) return
    const s = { id: crypto.randomUUID(), name: newStrategyName.trim(), created_at: new Date().toISOString() }
    addStrategy(s); setForm(prev => ({ ...prev, strategy_id: s.id })); setNewStrategyName(''); setShowNewStrategy(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const tradeId = crypto.randomUUID()

    let screenshotUrls: string[] = []
    if (files.length > 0) {
      setUploading(true)
      try {
        screenshotUrls = await Promise.all(
          files.map(async (file, i) => {
            const fileRef = ref(storage, `users/${user!.uid}/trades/${tradeId}/${Date.now()}_${i}_${file.name}`)
            await uploadBytes(fileRef, file)
            return getDownloadURL(fileRef)
          })
        )
      } catch (err) {
        console.error('Error al subir screenshots:', err)
      } finally {
        setUploading(false)
      }
    }

    const trade: Trade = {
      id: tradeId, symbol: form.symbol.toUpperCase(), instrument_type: form.instrument_type, direction: form.direction,
      entry_price: Number(form.entry_price) || 0, exit_price: Number(form.exit_price) || 0, position_size: Number(form.position_size) || 0,
      pnl: Number(form.pnl) || 0, risk_amount: Number(form.risk_amount) || undefined, stop_loss: Number(form.stop_loss) || undefined,
      take_profit: Number(form.take_profit) || undefined, entry_datetime: form.entry_datetime || new Date().toISOString(),
      exit_datetime: form.exit_datetime || new Date().toISOString(), strategy_id: useFreeSetup ? null : (form.strategy_id || null),
      custom_setup: useFreeSetup ? form.custom_setup : undefined, checklist_id: form.checklist_id || null, rating: form.rating,
      screenshots: screenshotUrls, notes: form.notes, created_at: new Date().toISOString(),
    }
    addTrade(trade); clearForm(); onSaved()
  }

  return (
    <Card className="p-6 md:p-8">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center"><span className="text-lg font-bold">+</span></div>
        <h2 className="serif text-2xl font-semibold">Registrar Operación</h2>
      </div>
      <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-8 ml-12">Añade los detalles de tu trade</p>

      <form onSubmit={handleSubmit} className="space-y-10">
        <Block icon={Boxes} title="Instrumento" first>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Símbolo"><input value={form.symbol} onChange={set('symbol')} placeholder="NQ, MNQ, ES, EURUSD..." className={inputCls} /></Field>
            <Field label="Tipo"><select value={form.instrument_type} onChange={set('instrument_type')} className={inputCls}><option>Futuros</option><option>Opciones</option><option>Forex</option><option>Acciones</option></select></Field>
            <Field label="Dirección"><DirectionToggle value={form.direction} onChange={v => setForm(p => ({ ...p, direction: v }))} /></Field>
          </div>
        </Block>
        <Block icon={DollarSign} title="Precios y Resultado">
          <div className="grid md:grid-cols-4 gap-4">
            <Field label="Precio Entrada"><input type="number" step="0.01" value={form.entry_price} onChange={set('entry_price')} className={inputCls} /></Field>
            <Field label="Precio Salida"><input type="number" step="0.01" value={form.exit_price} onChange={set('exit_price')} className={inputCls} /></Field>
            <Field label="Tamaño Posición (contratos)"><input type="number" value={form.position_size} onChange={set('position_size')} className={inputCls} /></Field>
            <Field label="P&L $ (manual)"><input type="number" step="0.01" placeholder="+250 / -120" value={form.pnl} onChange={set('pnl')} className={inputCls} /></Field>
            <Field label="Riesgo $"><input type="number" step="0.01" value={form.risk_amount} onChange={set('risk_amount')} className={inputCls} /></Field>
            <Field label="Stop Loss"><input type="number" step="0.01" value={form.stop_loss} onChange={set('stop_loss')} className={inputCls} /></Field>
            <Field label="Take Profit"><input type="number" step="0.01" value={form.take_profit} onChange={set('take_profit')} className={inputCls} /></Field>
          </div>
        </Block>
        <Block icon={Clock} title="Tiempo">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Fecha/Hora Entrada"><input type="datetime-local" value={form.entry_datetime} onChange={set('entry_datetime')} className={inputCls} /></Field>
            <Field label="Fecha/Hora Salida"><input type="datetime-local" value={form.exit_datetime} onChange={set('exit_datetime')} className={inputCls} /></Field>
          </div>
        </Block>
        <Block icon={BookOpen} title="Estrategia">
          <div className="flex items-center gap-2 mb-3">
            <button type="button" onClick={() => setUseFreeSetup(false)} className={`text-xs px-3 py-1 rounded-full ${!useFreeSetup ? 'bg-black/8 dark:bg-white/10 text-ink-900 dark:text-bone-100 font-semibold' : 'bg-black/5 dark:bg-white/5 text-ink-900/60 dark:text-bone-100/60'}`}>Playbook</button>
            <button type="button" onClick={() => setUseFreeSetup(true)} className={`text-xs px-3 py-1 rounded-full ${useFreeSetup ? 'bg-black/8 dark:bg-white/10 text-ink-900 dark:text-bone-100 font-semibold' : 'bg-black/5 dark:bg-white/5 text-ink-900/60 dark:text-bone-100/60'}`}>Setup libre</button>
          </div>
          {!useFreeSetup ? (
            strategies.length === 0 ? (
              !showNewStrategy ? (
                <button type="button" onClick={() => setShowNewStrategy(true)} className="text-sm text-accent font-medium hover:underline">No hay estrategias guardadas · Crear una</button>
              ) : (
                <div className="flex gap-2">
                  <input value={newStrategyName} onChange={e => setNewStrategyName(e.target.value)} placeholder="Nombre de la estrategia" className={inputCls} />
                  <button type="button" onClick={handleCreateStrategy} className="px-4 rounded-lg bg-accent text-white text-sm font-medium">Crear</button>
                </div>
              )
            ) : (
              <div className="flex gap-2 items-center">
                <select value={form.strategy_id} onChange={set('strategy_id')} className={inputCls}>
                  <option value="">Selecciona un setup del playbook</option>
                  {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button type="button" onClick={() => setShowNewStrategy(true)} className="text-xs text-accent whitespace-nowrap">+ Crear</button>
              </div>
            )
          ) : (
            <Field label="Setup del día (texto libre)"><input value={form.custom_setup} onChange={set('custom_setup')} placeholder="Ej: Ruptura de rango premarket" className={inputCls} /></Field>
          )}
        </Block>
        <Block icon={ListChecks} title="Confluencias y Rating">
          <div className="grid md:grid-cols-2 gap-4 items-end">
            <Field label="Checklist asociado">
              <select value={form.checklist_id} onChange={set('checklist_id')} className={inputCls}>
                <option value="">Sin checklist</option>
                {checklists.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Rating (1-10)">
              <div className="flex gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <button key={i} type="button" onClick={() => setForm(p => ({ ...p, rating: i + 1 }))}>
                    <Star size={20} className={i < form.rating ? 'fill-amber-400 text-amber-400' : 'text-black/15 dark:text-white/15'} />
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </Block>
        <Block icon={Paperclip} title="Adjuntos y Notas">
          <div onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
            className={`border-2 border-dashed rounded-xl p-6 text-center mb-4 transition ${dragOver ? 'border-accent bg-accent/5' : 'border-black/10 dark:border-white/10'}`}>
            <UploadCloud className="mx-auto mb-2 text-ink-900/30 dark:text-bone-100/30" />
            <p className="text-sm text-ink-900/50 dark:text-bone-100/50">Arrastra tus screenshots aquí o</p>
            <label className="text-accent text-sm font-medium cursor-pointer hover:underline">
              selecciona archivos
              <input type="file" accept="image/png,image/jpeg" multiple hidden onChange={e => handleFiles(e.target.files)} />
            </label>
            <p className="text-[11px] text-ink-900/30 dark:text-bone-100/30 mt-1">PNG/JPG hasta 5MB</p>
            {files.length > 0 && <p className="text-xs mt-3 text-accent">{files.length} archivo(s) seleccionado(s)</p>}
          </div>
          <Field label="Notas"><textarea value={form.notes} onChange={set('notes')} rows={4} placeholder="¿Qué viste? ¿Cómo gestionaste la operación?" className={inputCls} /></Field>
        </Block>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={clearForm} className="px-5 py-2.5 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">Limpiar</button>
          <button type="submit" disabled={uploading} className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light disabled:opacity-50">
            {uploading ? 'Subiendo capturas...' : '+ Registrar Trade'}
          </button>
        </div>
      </form>
    </Card>
  )
}

/* ==================== EDIT TRADE FORM (dentro del modal) ==================== */
function TradeEditForm({ trade, onCancel, onSaved }: { trade: Trade; onCancel: () => void; onSaved: (t: Trade) => void }) {
  const { strategies, addStrategy, checklists, updateTrade } = useAppData()
  const { user } = useAuth()
  const [form, setForm] = useState(tradeToForm(trade))
  const [useFreeSetup, setUseFreeSetup] = useState(!trade.strategy_id && !!trade.custom_setup)
  const [newStrategyName, setNewStrategyName] = useState('')
  const [showNewStrategy, setShowNewStrategy] = useState(false)
  const [existingScreenshots, setExistingScreenshots] = useState<string[]>(trade.screenshots || [])
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)

  const set = (key: keyof typeof form) => (e: any) => {
    const value = e?.target ? e.target.value : e
    setForm(prev => ({ ...prev, [key]: value }))
  }
  const removeExistingScreenshot = (url: string) => {
    setExistingScreenshots(prev => prev.filter(s => s !== url))
  }
  const handleCreateStrategy = () => {
    if (!newStrategyName.trim()) return
    const s = { id: crypto.randomUUID(), name: newStrategyName.trim(), created_at: new Date().toISOString() }
    addStrategy(s); setForm(prev => ({ ...prev, strategy_id: s.id })); setNewStrategyName(''); setShowNewStrategy(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    let screenshotUrls = [...existingScreenshots]
    if (newFiles.length > 0) {
      setUploading(true)
      try {
        const uploaded = await Promise.all(
          newFiles.map(async (file, i) => {
            const fileRef = ref(storage, `users/${user!.uid}/trades/${trade.id}/${Date.now()}_${i}_${file.name}`)
            await uploadBytes(fileRef, file)
            return getDownloadURL(fileRef)
          })
        )
        screenshotUrls = [...screenshotUrls, ...uploaded]
      } catch (err) {
        console.error('Error al subir screenshots:', err)
      } finally {
        setUploading(false)
      }
    }

    const updated: Partial<Trade> = {
      symbol: form.symbol.toUpperCase(),
      instrument_type: form.instrument_type,
      direction: form.direction,
      entry_price: Number(form.entry_price) || 0,
      exit_price: Number(form.exit_price) || 0,
      position_size: Number(form.position_size) || 0,
      pnl: Number(form.pnl) || 0,
      risk_amount: form.risk_amount !== '' ? Number(form.risk_amount) : undefined,
      stop_loss: form.stop_loss !== '' ? Number(form.stop_loss) : undefined,
      take_profit: form.take_profit !== '' ? Number(form.take_profit) : undefined,
      entry_datetime: form.entry_datetime || trade.entry_datetime,
      exit_datetime: form.exit_datetime || trade.exit_datetime,
      strategy_id: useFreeSetup ? null : (form.strategy_id || null),
      custom_setup: useFreeSetup ? form.custom_setup : undefined,
      checklist_id: form.checklist_id || null,
      rating: form.rating,
      screenshots: screenshotUrls,
      notes: form.notes,
    }
    updateTrade(trade.id, updated)
    onSaved({ ...trade, ...updated })
  }

  return (
    <form onSubmit={handleSave} className="space-y-8">
      <h2 className="serif text-2xl font-semibold mb-1">Editar Operación</h2>
      <p className="text-sm text-ink-900/50 dark:text-bone-100/50 -mt-6 mb-2">Modifica los datos y guarda los cambios</p>

      <Block icon={Boxes} title="Instrumento" first>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Símbolo"><input value={form.symbol} onChange={set('symbol')} className={inputCls} /></Field>
          <Field label="Tipo"><select value={form.instrument_type} onChange={set('instrument_type')} className={inputCls}><option>Futuros</option><option>Opciones</option><option>Forex</option><option>Acciones</option></select></Field>
          <Field label="Dirección"><DirectionToggle value={form.direction} onChange={v => setForm(p => ({ ...p, direction: v }))} /></Field>
        </div>
      </Block>

      <Block icon={DollarSign} title="Precios y Resultado">
        <div className="grid md:grid-cols-4 gap-4">
          <Field label="Precio Entrada"><input type="number" step="0.01" value={form.entry_price} onChange={set('entry_price')} className={inputCls} /></Field>
          <Field label="Precio Salida"><input type="number" step="0.01" value={form.exit_price} onChange={set('exit_price')} className={inputCls} /></Field>
          <Field label="Tamaño Posición"><input type="number" value={form.position_size} onChange={set('position_size')} className={inputCls} /></Field>
          <Field label="P&L $ (manual)"><input type="number" step="0.01" value={form.pnl} onChange={set('pnl')} className={inputCls} /></Field>
          <Field label="Riesgo $"><input type="number" step="0.01" value={form.risk_amount} onChange={set('risk_amount')} className={inputCls} /></Field>
          <Field label="Stop Loss"><input type="number" step="0.01" value={form.stop_loss} onChange={set('stop_loss')} className={inputCls} /></Field>
          <Field label="Take Profit"><input type="number" step="0.01" value={form.take_profit} onChange={set('take_profit')} className={inputCls} /></Field>
        </div>
      </Block>

      <Block icon={Clock} title="Tiempo">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Fecha/Hora Entrada"><input type="datetime-local" value={form.entry_datetime} onChange={set('entry_datetime')} className={inputCls} /></Field>
          <Field label="Fecha/Hora Salida"><input type="datetime-local" value={form.exit_datetime} onChange={set('exit_datetime')} className={inputCls} /></Field>
        </div>
      </Block>

      <Block icon={BookOpen} title="Estrategia">
        <div className="flex items-center gap-2 mb-3">
          <button type="button" onClick={() => setUseFreeSetup(false)} className={`text-xs px-3 py-1 rounded-full ${!useFreeSetup ? 'bg-black/8 dark:bg-white/10 text-ink-900 dark:text-bone-100 font-semibold' : 'bg-black/5 dark:bg-white/5 text-ink-900/60 dark:text-bone-100/60'}`}>Playbook</button>
          <button type="button" onClick={() => setUseFreeSetup(true)} className={`text-xs px-3 py-1 rounded-full ${useFreeSetup ? 'bg-black/8 dark:bg-white/10 text-ink-900 dark:text-bone-100 font-semibold' : 'bg-black/5 dark:bg-white/5 text-ink-900/60 dark:text-bone-100/60'}`}>Setup libre</button>
        </div>
        {!useFreeSetup ? (
          <div className="flex gap-2 items-center">
            {showNewStrategy ? (
              <>
                <input value={newStrategyName} onChange={e => setNewStrategyName(e.target.value)} placeholder="Nombre de la estrategia" className={inputCls} />
                <button type="button" onClick={handleCreateStrategy} className="px-4 rounded-lg bg-accent text-white text-sm font-medium whitespace-nowrap">Crear</button>
              </>
            ) : (
              <>
                <select value={form.strategy_id} onChange={set('strategy_id')} className={inputCls}>
                  <option value="">Selecciona un setup del playbook</option>
                  {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button type="button" onClick={() => setShowNewStrategy(true)} className="text-xs text-accent whitespace-nowrap">+ Crear</button>
              </>
            )}
          </div>
        ) : (
          <Field label="Setup del día (texto libre)"><input value={form.custom_setup} onChange={set('custom_setup')} className={inputCls} /></Field>
        )}
      </Block>

      <Block icon={ListChecks} title="Confluencias y Rating">
        <div className="grid md:grid-cols-2 gap-4 items-end">
          <Field label="Checklist asociado">
            <select value={form.checklist_id} onChange={set('checklist_id')} className={inputCls}>
              <option value="">Sin checklist</option>
              {checklists.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Rating (1-10)">
            <div className="flex gap-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <button key={i} type="button" onClick={() => setForm(p => ({ ...p, rating: i + 1 }))}>
                  <Star size={20} className={i < form.rating ? 'fill-amber-400 text-amber-400' : 'text-black/15 dark:text-white/15'} />
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Block>

      <Block icon={Paperclip} title="Adjuntos y Notas">
        {existingScreenshots.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-3">
            {existingScreenshots.map((src, i) => (
              <div key={i} className="relative">
                <img src={src} className="w-16 h-16 object-cover rounded-lg border border-black/10 dark:border-white/10" />
                <button type="button" onClick={() => removeExistingScreenshot(src)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-loss text-white text-xs flex items-center justify-center shadow">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <ScreenshotUploader files={newFiles} onChange={setNewFiles} />
        <div className="mt-4">
          <Field label="Notas"><textarea value={form.notes} onChange={set('notes')} rows={4} className={inputCls} /></Field>
        </div>
      </Block>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">Cancelar</button>
        <button type="submit" disabled={uploading} className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light disabled:opacity-50">
          {uploading ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}

/* ==================== TRADE HISTORY ==================== */
function TradeHistory() {
  const { trades, strategies, settings, deleteTrade } = useAppData()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<'exit_datetime' | 'symbol' | 'pnl'>('exit_datetime')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [mode, setMode] = useState<'view' | 'edit' | 'confirmDelete'>('view')

  const filtered = useMemo(() => {
    let list = trades.filter(t => t.symbol.toLowerCase().includes(search.toLowerCase()))
    list = list.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'symbol') cmp = a.symbol.localeCompare(b.symbol)
      if (sortKey === 'pnl') cmp = a.pnl - b.pnl
      if (sortKey === 'exit_datetime') cmp = new Date(a.exit_datetime).getTime() - new Date(b.exit_datetime).getTime()
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [trades, search, sortKey, sortDir])
  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc')); else { setSortKey(key); setSortDir('desc') }
  }

  const openTrade = (t: Trade) => { setSelectedTrade(t); setMode('view') }
  const closeModal = () => { setSelectedTrade(null); setMode('view') }
  const confirmAndDelete = () => {
    if (!selectedTrade) return
    deleteTrade(selectedTrade.id)
    closeModal()
  }

  const selectedStrat = selectedTrade ? strategies.find(s => s.id === selectedTrade.strategy_id) : null
  const selectedNet = selectedTrade ? getNetPnl(selectedTrade, settings) : 0
  const selectedCls = selectedTrade ? classifyTrade(selectedTrade, settings) : null

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="serif text-xl font-semibold">Historial de Operaciones</h3>
        <input placeholder="Buscar símbolo..." value={search} onChange={e => setSearch(e.target.value)} className="bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm w-56" />
      </div>
      {trades.length === 0 ? <p className="text-sm text-ink-900/40 dark:text-bone-100/40 py-10 text-center">Aún no has registrado ninguna operación.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40 border-b border-black/5 dark:border-white/5">
                <th className="py-3 cursor-pointer" onClick={() => toggleSort('exit_datetime')}><span className="flex items-center gap-1">Fecha <ArrowUpDown size={12} /></span></th>
                <th className="py-3 cursor-pointer" onClick={() => toggleSort('symbol')}><span className="flex items-center gap-1">Símbolo <ArrowUpDown size={12} /></span></th>
                <th className="py-3">Dirección</th><th className="py-3">Estrategia</th><th className="py-3">Rating</th>
                <th className="py-3 cursor-pointer" onClick={() => toggleSort('pnl')}><span className="flex items-center gap-1">P&L Bruto <ArrowUpDown size={12} /></span></th>
                <th className="py-3">P&L Neto</th><th className="py-3">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const strat = strategies.find(s => s.id === t.strategy_id)
                const net = getNetPnl(t, settings)
                const cls = classifyTrade(t, settings)
                return (
                  <tr key={t.id} onClick={() => openTrade(t)} className="border-b border-black/5 dark:border-white/5 last:border-0 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <td className="py-3">{new Date(t.exit_datetime).toLocaleString()}</td>
                    <td className="py-3 font-medium">{t.symbol}</td>
                    <td className="py-3"><span className={`text-[10px] font-bold px-2 py-1 rounded ${t.direction === 'long' ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'}`}>{t.direction.toUpperCase()}</span></td>
                    <td className="py-3">{strat?.name || t.custom_setup || '—'}</td>
                    <td className="py-3">{t.rating ? `${t.rating}/10` : '—'}</td>
                    <td className={`py-3 font-medium ${t.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(t.pnl)}</td>
                    <td className={`py-3 font-medium ${net >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(net)}</td>
                    <td className="py-3"><span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${cls === 'win' ? 'bg-profit/10 text-profit' : cls === 'loss' ? 'bg-loss/10 text-loss' : 'bg-amber-400/10 text-amber-500'}`}>{cls === 'be' ? 'breakeven' : cls}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!selectedTrade} onClose={closeModal} widthClass={mode === 'edit' ? 'max-w-4xl' : 'max-w-2xl'}>
        {selectedTrade && mode === 'view' && (
          <div>
            <div className="flex items-start justify-between mb-6 pr-8">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className={`text-xs font-bold px-2 py-1 rounded ${selectedTrade.direction === 'long' ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'}`}>{selectedTrade.direction.toUpperCase()}</span>
                  <h2 className="serif text-2xl font-semibold">{selectedTrade.symbol}</h2>
                </div>
                <p className="text-xs text-ink-900/40 dark:text-bone-100/40">{new Date(selectedTrade.exit_datetime).toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setMode('edit')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5">
                  <Pencil size={13} /> Editar
                </button>
                <button onClick={() => setMode('confirmDelete')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-loss/30 text-loss text-xs font-medium hover:bg-loss/10">
                  <Trash2 size={13} /> Eliminar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <MiniMetric label="Entrada" value={String(selectedTrade.entry_price)} />
              <MiniMetric label="Salida" value={String(selectedTrade.exit_price)} />
              <MiniMetric label="Tamaño" value={String(selectedTrade.position_size)} />
              <MiniMetric label="Rating" value={selectedTrade.rating ? `${selectedTrade.rating}/10` : '—'} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <StatCard label="P&L Bruto" value={fmt(selectedTrade.pnl)} positive={selectedTrade.pnl >= 0} />
              <StatCard label="P&L Neto" value={fmt(selectedNet)} positive={selectedNet >= 0} />
              <StatCard label="Resultado" value={selectedCls === 'be' ? 'Breakeven' : selectedCls === 'win' ? 'Ganadora' : 'Perdedora'} positive={selectedCls === 'win' ? true : selectedCls === 'loss' ? false : null} />
            </div>

            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-1">Estrategia</p>
              <p className="text-sm">{selectedStrat?.name || selectedTrade.custom_setup || 'Sin etiquetar'}</p>
            </div>

            {selectedTrade.notes && (
              <div className="mb-6">
                <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-1">Notas</p>
                <p className="text-sm whitespace-pre-wrap">{selectedTrade.notes}</p>
              </div>
            )}

            {selectedTrade.screenshots && selectedTrade.screenshots.length > 0 ? (
              <div>
                <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-2">Screenshots</p>
                <div className="grid grid-cols-2 gap-3">
                  {selectedTrade.screenshots.map((src, i) => (
                    <a key={i} href={src} target="_blank" rel="noreferrer">
                      <img src={src} className="w-full h-48 object-cover rounded-lg border border-black/10 dark:border-white/10 hover:opacity-90 transition" />
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink-900/30 dark:text-bone-100/30">Este trade no tiene capturas adjuntas.</p>
            )}
          </div>
        )}

        {selectedTrade && mode === 'edit' && (
          <TradeEditForm
            trade={selectedTrade}
            onCancel={() => setMode('view')}
            onSaved={(updated) => { setSelectedTrade(updated); setMode('view') }}
          />
        )}

        {selectedTrade && mode === 'confirmDelete' && (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-loss/10 text-loss flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={26} />
            </div>
            <h2 className="serif text-xl font-semibold mb-2">¿Eliminar esta operación?</h2>
            <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-6">
              Estás a punto de eliminar el trade de <strong>{selectedTrade.symbol}</strong> del {new Date(selectedTrade.exit_datetime).toLocaleDateString()}. Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setMode('view')} className="px-5 py-2.5 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">Cancelar</button>
              <button onClick={confirmAndDelete} className="px-5 py-2.5 rounded-lg bg-loss text-white text-sm font-semibold hover:opacity-90">Sí, eliminar</button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}

/* ==================== TRADES PAGE (default export) ==================== */
export default function TradesPage() {
  const [tab, setTab] = useState('new')
  return (
    <div>
      <SectionHeader eyebrow="Trades" title="Operaciones" subtitle="Registra y revisa cada una de tus operaciones." />
      <div className="mb-6"><PillTabs tabs={[{ id: 'new', label: 'Nuevo Trade' }, { id: 'history', label: 'Historial' }]} active={tab} onChange={setTab} /></div>
      {tab === 'new' ? <TradeForm onSaved={() => setTab('history')} /> : <TradeHistory />}
    </div>
  )
}