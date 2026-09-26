import React, { useMemo, useState } from 'react'
import { Boxes, DollarSign, Clock, BookOpen, ListChecks, Paperclip, UploadCloud, Star, Sparkles } from 'lucide-react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase'
import { useAppData, useAuth } from '../contexts'
import { fmt } from '../utils'
import { calculateAutoPnl } from '../calculations'
import type { Trade, Direction, InstrumentType } from '../types'
import { Card, Field, inputCls, DirectionToggle, Block, Modal, ScreenshotUploader } from './ui'
import { extractTrades, type ExtractedTradeData } from '../lib/aiTradeExtractor'
import { TradePreviewCards, buildPreviewTrade, type PreviewTrade } from './TradePreviewCards'

const emptyForm = {
  symbol: '', instrument_type: 'Futuros' as InstrumentType, direction: 'long' as Direction,
  entry_price: '', exit_price: '', position_size: '', pnl: '', risk_amount: '', stop_loss: '', take_profit: '',
  entry_datetime: '', exit_datetime: '', strategy_id: '', custom_setup: '', checklist_id: '', account_id: '', rating: 0, notes: '',
}

const INSTRUMENT_OPTIONS: InstrumentType[] = ['Futuros', 'Opciones', 'Forex', 'Acciones', 'Crypto']

function extractedToFormPatch(t: ExtractedTradeData, accountId: string | null): Partial<typeof emptyForm> {
  const patch: Partial<typeof emptyForm> = {}
  if (t.symbol) patch.symbol = t.symbol
  if (t.instrument_type) patch.instrument_type = t.instrument_type
  if (t.direction) patch.direction = t.direction
  if (t.entry_price != null) patch.entry_price = String(t.entry_price)
  if (t.exit_price != null) patch.exit_price = String(t.exit_price)
  if (t.position_size != null) patch.position_size = String(t.position_size)
  if (t.pnl != null) patch.pnl = String(t.pnl)
  if (t.stop_loss != null) patch.stop_loss = String(t.stop_loss)
  if (t.take_profit != null) patch.take_profit = String(t.take_profit)
  if (t.entry_datetime) patch.entry_datetime = t.entry_datetime
  if (t.exit_datetime) patch.exit_datetime = t.exit_datetime
  if (t.notes) patch.notes = t.notes
  if (accountId) patch.account_id = accountId
  return patch
}

/* ==================== MODAL DE ANÁLISIS CON IA ==================== */
function AITradeModal({ open, onClose, onExtracted }: { open: boolean; onClose: () => void; onExtracted: (data: Partial<typeof emptyForm>) => void }) {
  const { addTrade, accounts } = useAppData()
  const [files, setFiles] = useState<File[]>([])
  const [pastedText, setPastedText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previews, setPreviews] = useState<PreviewTrade[] | null>(null)
  const [detectedAccountId, setDetectedAccountId] = useState<string | null>(null)

  const handleAnalyze = async () => {
    if (files.length === 0 && !pastedText.trim()) {
      setError('Sube una captura o pega los datos de la operación.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      const { accountId, trades } = await extractTrades(apiKey, files, pastedText, accounts)

      if (trades.length === 1) {
        onExtracted(extractedToFormPatch(trades[0], accountId))
        setFiles([])
        setPastedText('')
      } else {
        setDetectedAccountId(accountId)
        setPreviews(trades.map(t => buildPreviewTrade(t, accountId || '')))
      }
    } catch (err: any) {
      setError(err.message || 'No se pudo analizar la operación. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFiles([]); setPastedText(''); setError(null); setPreviews(null); setDetectedAccountId(null)
    onClose()
  }

  const updatePreview = (tempId: string, patch: Partial<PreviewTrade>) => {
    setPreviews(prev => prev ? prev.map(p => (p.tempId === tempId ? { ...p, ...patch } : p)) : prev)
  }
  const removePreview = (tempId: string) => {
    setPreviews(prev => prev ? prev.filter(p => p.tempId !== tempId) : prev)
  }
  const applyAccountToAll = (accountId: string) => {
    setDetectedAccountId(accountId || null)
    setPreviews(prev => prev ? prev.map(p => ({ ...p, account_id: accountId })) : prev)
  }

  const handleConfirmAll = () => {
    if (!previews) return
    previews.forEach(p => {
      const trade: Trade = {
        id: crypto.randomUUID(),
        symbol: p.symbol,
        instrument_type: p.instrument_type,
        direction: p.direction,
        entry_price: p.entry_price,
        exit_price: p.exit_price,
        position_size: p.position_size,
        pnl: p.pnl,
        stop_loss: p.stop_loss,
        take_profit: p.take_profit,
        entry_datetime: p.entry_datetime,
        exit_datetime: p.exit_datetime,
        strategy_id: null,
        account_id: p.account_id || null,
        notes: p.notes,
        created_at: new Date().toISOString(),
      }
      addTrade(trade)
    })
    handleClose()
  }

  const detectedAccountName = accounts.find(a => a.id === detectedAccountId)?.name
  const isPreviewMode = !!previews

  return (
    <Modal open={open} onClose={handleClose} widthClass={isPreviewMode ? 'max-w-4xl' : 'max-w-lg'}>
      {!isPreviewMode ? (
        <>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={18} className="text-accent" />
            <h2 className="serif text-xl font-semibold">Registrar con IA</h2>
          </div>
          <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-6">
            Sube una captura de tu broker o pega los datos de la operación (una o varias) y Nova los rellenará por ti.
          </p>

          <ScreenshotUploader files={files} onChange={setFiles} />

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
            <span className="text-[11px] uppercase tracking-widest text-ink-900/30 dark:text-bone-100/30">o</span>
            <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
          </div>

          <textarea
            value={pastedText}
            onChange={e => setPastedText(e.target.value)}
            rows={4}
            placeholder="Pega aquí el texto de tu operación (símbolo, entrada, salida, tamaño...) o una tabla con varias operaciones de tu broker"
            className={inputCls}
          />

          {error && <p className="text-xs text-loss mt-3">{error}</p>}

          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={handleClose} className="px-5 py-2.5 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light disabled:opacity-50"
            >
              <Sparkles size={15} />
              {loading ? 'Analizando...' : 'Analizar y rellenar'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-accent" />
            <h2 className="serif text-xl font-semibold">Nova detectó {previews!.length} operaciones</h2>
          </div>
          <TradePreviewCards
            previews={previews!}
            accounts={accounts}
            detectedAccountId={detectedAccountId}
            detectedAccountName={detectedAccountName}
            onUpdate={updatePreview}
            onRemove={removePreview}
            onAccountChangeAll={applyAccountToAll}
            onConfirm={handleConfirmAll}
          />
          <div className="flex justify-start mt-3">
            <button type="button" onClick={() => { setPreviews(null); setDetectedAccountId(null) }} className="text-xs text-ink-900/40 dark:text-bone-100/40 hover:underline">
              ← Volver a subir otra cosa
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

/* ==================== TRADE FORM (Nuevo Trade) ==================== */
export function TradeForm({ onSaved }: { onSaved: () => void }) {
  const { strategies, addStrategy, checklists, addTrade, accounts } = useAppData()
  const { user } = useAuth()
  const [form, setForm] = useState(emptyForm)
  const [useFreeSetup, setUseFreeSetup] = useState(false)
  const [newStrategyName, setNewStrategyName] = useState('')
  const [showNewStrategy, setShowNewStrategy] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showAIModal, setShowAIModal] = useState(false)

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

  const handleAIExtracted = (data: Partial<typeof emptyForm>) => {
    setForm(prev => ({ ...prev, ...data }))
    setShowAIModal(false)
  }

  const relevantAccounts = useMemo(() => accounts.filter(a => a.instrument_type === form.instrument_type), [accounts, form.instrument_type])

  const autoPnl = useMemo(() => calculateAutoPnl({
    instrument_type: form.instrument_type,
    symbol: form.symbol,
    direction: form.direction,
    entry_price: Number(form.entry_price) || 0,
    exit_price: Number(form.exit_price) || 0,
    position_size: Number(form.position_size) || 0,
  }), [form.instrument_type, form.symbol, form.direction, form.entry_price, form.exit_price, form.position_size])

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

    const finalPnl = form.pnl.trim() !== '' ? Number(form.pnl) : autoPnl

    const trade: Trade = {
      id: tradeId, symbol: form.symbol.toUpperCase(), instrument_type: form.instrument_type, direction: form.direction,
      entry_price: Number(form.entry_price) || 0, exit_price: Number(form.exit_price) || 0, position_size: Number(form.position_size) || 0,
      pnl: finalPnl, risk_amount: Number(form.risk_amount) || undefined, stop_loss: Number(form.stop_loss) || undefined,
      take_profit: Number(form.take_profit) || undefined, entry_datetime: form.entry_datetime || new Date().toISOString(),
      exit_datetime: form.exit_datetime || new Date().toISOString(), strategy_id: useFreeSetup ? null : (form.strategy_id || null),
      custom_setup: useFreeSetup ? form.custom_setup : undefined, checklist_id: form.checklist_id || null,
      account_id: form.account_id || null, rating: form.rating,
      screenshots: screenshotUrls, notes: form.notes, created_at: new Date().toISOString(),
    }
    addTrade(trade); clearForm(); onSaved()
  }

  return (
    <Card className="p-6 md:p-8">
      <div className="flex items-start justify-between mb-1 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center"><span className="text-lg font-bold">+</span></div>
          <h2 className="serif text-2xl font-semibold">Registrar Operación</h2>
        </div>
        <button
          type="button"
          onClick={() => setShowAIModal(true)}
          className="group relative flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-accent to-accent-light text-white text-sm font-semibold shadow-soft hover:shadow-lg hover:scale-[1.02] transition-all overflow-hidden"
        >
          <Sparkles size={15} className="relative z-10 group-hover:rotate-12 transition-transform" />
          <span className="relative z-10">Agregar con IA</span>
          <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>
      <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-8 ml-12">Añade los detalles de tu trade</p>

      <form onSubmit={handleSubmit} className="space-y-10">
        <Block icon={Boxes} title="Instrumento" first>
          <div className="grid md:grid-cols-4 gap-4">
            <Field label="Símbolo"><input value={form.symbol} onChange={set('symbol')} placeholder="NQ, MNQ, ES, EURUSD..." className={inputCls} /></Field>
            <Field label="Tipo">
              <select value={form.instrument_type} onChange={set('instrument_type')} className={inputCls}>
                {INSTRUMENT_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Dirección"><DirectionToggle value={form.direction} onChange={v => setForm(p => ({ ...p, direction: v }))} /></Field>
            <Field label="Cuenta (opcional)">
              <select value={form.account_id} onChange={set('account_id')} className={inputCls}>
                <option value="">Sin cuenta asignada</option>
                {relevantAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          </div>
        </Block>
        <Block icon={DollarSign} title="Precios y Resultado">
          <div className="grid md:grid-cols-4 gap-4">
            <Field label="Precio Entrada"><input type="number" step="0.01" value={form.entry_price} onChange={set('entry_price')} className={inputCls} /></Field>
            <Field label="Precio Salida"><input type="number" step="0.01" value={form.exit_price} onChange={set('exit_price')} className={inputCls} /></Field>
            <Field label="Tamaño Posición (contratos)"><input type="number" value={form.position_size} onChange={set('position_size')} className={inputCls} /></Field>
            <Field label="P&L $ (opcional)">
              <input type="number" step="0.01" placeholder={`Auto: ${fmt(autoPnl)}`} value={form.pnl} onChange={set('pnl')} className={inputCls} />
              <p className="text-[11px] text-ink-900/40 dark:text-bone-100/40 mt-1">
                Vacío = cálculo automático (<strong>{fmt(autoPnl)}</strong>). Rellénalo solo si quieres forzar otro valor.
              </p>
            </Field>
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

      <AITradeModal open={showAIModal} onClose={() => setShowAIModal(false)} onExtracted={handleAIExtracted} />
    </Card>
  )
}