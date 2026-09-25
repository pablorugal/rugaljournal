import React, { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays, FileText, Paperclip, CheckCircle2, Pencil, Trash2, AlertTriangle,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase'
import { useAppData, useAuth } from '../contexts'
import { todayISO, isSameDay, getMonthMatrix, toISODate, MONTHS_ES, DAYS_ES } from '../utils'
import type { BiasMarket, BiasDirection, BiasOutcome, DailyBiasEntry } from '../types'
import {
  Card, SectionHeader, PillTabs, ChipButton, ScreenshotUploader, Field, inputCls, Modal,
  Block, MiniMetric,
} from '../components/ui'

const BIAS_MARKETS: BiasMarket[] = ['Futuros', 'Forex', 'Acciones']
const BIAS_DIRECTIONS: BiasDirection[] = ['Alcista', 'Bajista', 'Rango', 'Sin sesgo']

async function uploadBiasFiles(files: File[], pathPrefix: string): Promise<string[]> {
  return Promise.all(files.map(async (file, i) => {
    const fileRef = ref(storage, `${pathPrefix}/${Date.now()}_${i}_${file.name}`)
    await uploadBytes(fileRef, file)
    return getDownloadURL(fileRef)
  }))
}

function outcomeBadgeClass(outcome?: BiasOutcome | '') {
  if (outcome === 'Acertado') return 'bg-profit/10 text-profit'
  if (outcome === 'Fallado') return 'bg-loss/10 text-loss'
  if (outcome === 'Parcial') return 'bg-amber-400/10 text-amber-500'
  return 'bg-black/5 dark:bg-white/10 text-ink-900/60 dark:text-bone-100/60'
}

/* ==================== SHARED ==================== */
function ScreenshotGrid({ urls, onRemove }: { urls: string[]; onRemove?: (url: string) => void }) {
  if (!urls || urls.length === 0) return null
  return (
    <div className="flex gap-2 flex-wrap">
      {urls.map((src, i) => (
        <div key={i} className="relative">
          <a href={src} target="_blank" rel="noreferrer">
            <img src={src} className="w-16 h-16 object-cover rounded-lg border border-black/10 dark:border-white/10" />
          </a>
          {onRemove && (
            <button type="button" onClick={() => onRemove(src)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-loss text-white text-xs flex items-center justify-center shadow">
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

/* ==================== DAILY: NUEVO BIAS ==================== */
function DailyBiasForm({ market }: { market: BiasMarket }) {
  const { dailyBias, upsertDailyBias } = useAppData()
  const { user } = useAuth()
  const uid = user!.uid

  const [date, setDate] = useState(todayISO())
  const [symbol, setSymbol] = useState('')
  const [direction, setDirection] = useState<BiasDirection>('Sin sesgo')
  const [expectedDesc, setExpectedDesc] = useState('')
  const [expectedFiles, setExpectedFiles] = useState<File[]>([])
  const [actualDesc, setActualDesc] = useState('')
  const [actualFiles, setActualFiles] = useState<File[]>([])
  const [outcome, setOutcome] = useState<BiasOutcome | ''>('')
  const [savingExpected, setSavingExpected] = useState(false)
  const [savingActual, setSavingActual] = useState(false)

  const currentEntry = useMemo(() => dailyBias.find(e => e.date === date && e.market === market), [dailyBias, date, market])

  useEffect(() => {
    if (currentEntry) {
      setSymbol(currentEntry.symbol || '')
      setDirection(currentEntry.expected_direction)
      setExpectedDesc(currentEntry.expected_description)
      setActualDesc(currentEntry.actual_description || '')
      setOutcome(currentEntry.outcome || '')
    } else {
      setSymbol(''); setDirection('Sin sesgo'); setExpectedDesc(''); setActualDesc(''); setOutcome('')
    }
    setExpectedFiles([]); setActualFiles([])
  }, [date, market]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveExpected = async () => {
    setSavingExpected(true)
    try {
      const base: DailyBiasEntry = currentEntry ? { ...currentEntry } : {
        id: crypto.randomUUID(), date, market, expected_direction: direction, expected_description: expectedDesc,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }
      base.symbol = symbol.trim() || undefined
      base.expected_direction = direction
      base.expected_description = expectedDesc
      if (expectedFiles.length) {
        const urls = await uploadBiasFiles(expectedFiles, `users/${uid}/bias/${base.id}/expected`)
        base.expected_screenshots = [...(base.expected_screenshots || []), ...urls]
      }
      base.updated_at = new Date().toISOString()
      upsertDailyBias(base)
      setExpectedFiles([])
    } catch (err) {
      console.error('Error al guardar expectativa:', err)
    } finally {
      setSavingExpected(false)
    }
  }
  const saveActual = async () => {
    setSavingActual(true)
    try {
      const base: DailyBiasEntry = currentEntry ? { ...currentEntry } : {
        id: crypto.randomUUID(), date, market, expected_direction: direction, expected_description: expectedDesc,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }
      base.symbol = symbol.trim() || undefined
      base.actual_description = actualDesc
      base.outcome = outcome || undefined
      if (actualFiles.length) {
        const urls = await uploadBiasFiles(actualFiles, `users/${uid}/bias/${base.id}/actual`)
        base.actual_screenshots = [...(base.actual_screenshots || []), ...urls]
      }
      base.updated_at = new Date().toISOString()
      upsertDailyBias(base)
      setActualFiles([])
    } catch (err) {
      console.error('Error al guardar resultado:', err)
    } finally {
      setSavingActual(false)
    }
  }

  return (
    <Card className="p-6 md:p-8">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="serif text-2xl font-semibold">Registrar Bias — {market}</h2>
          <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mt-1">Define tu expectativa del día y, cuando el mercado cierre, registra qué pasó realmente.</p>
        </div>
        {currentEntry?.outcome && (
          <span className={`text-xs font-bold uppercase px-3 py-1.5 rounded-full ${outcomeBadgeClass(currentEntry.outcome)}`}>{currentEntry.outcome}</span>
        )}
      </div>

      <div className="space-y-6">
        <Block icon={CalendarDays} title="Contexto" first>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <Field label="Fecha"><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} /></Field>
            <Field label="Símbolo (opcional)">
              <input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="EURUSD, BTCUSD, NQ..." className={inputCls} />
            </Field>
          </div>
          <Field label="Dirección esperada">
            <div className="flex flex-wrap gap-2">
              {BIAS_DIRECTIONS.map(d => <ChipButton key={d} active={direction === d} onClick={() => setDirection(d)}>{d}</ChipButton>)}
            </div>
          </Field>
        </Block>

        <Block icon={FileText} title="Análisis y Expectativa">
          <Field label="¿Qué esperas hoy?"><textarea rows={4} value={expectedDesc} onChange={e => setExpectedDesc(e.target.value)} placeholder="Niveles, estructura, catalizadores..." className={inputCls} /></Field>
          <div className="mt-4">
            <ScreenshotUploader files={expectedFiles} onChange={setExpectedFiles} />
            <div className="mt-3"><ScreenshotGrid urls={currentEntry?.expected_screenshots || []} /></div>
          </div>
          <div className="flex justify-end pt-4">
            <button onClick={saveExpected} disabled={savingExpected} className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light disabled:opacity-50">
              {savingExpected ? 'Guardando...' : 'Guardar expectativa'}
            </button>
          </div>
        </Block>

        {currentEntry && (
          <Block icon={CheckCircle2} title="Resultado Real">
            <Field label="Resultado">
              <div className="flex flex-wrap gap-2">
                {(['Acertado', 'Parcial', 'Fallado'] as BiasOutcome[]).map(o => <ChipButton key={o} active={outcome === o} onClick={() => setOutcome(o)}>{o}</ChipButton>)}
              </div>
            </Field>
            <Field label="¿Qué pasó realmente?"><textarea rows={4} value={actualDesc} onChange={e => setActualDesc(e.target.value)} placeholder="Describe cómo se comportó el mercado frente a tu expectativa..." className={inputCls} /></Field>
            <div className="mt-4">
              <ScreenshotUploader files={actualFiles} onChange={setActualFiles} />
              <div className="mt-3"><ScreenshotGrid urls={currentEntry?.actual_screenshots || []} /></div>
            </div>
            <div className="flex justify-end pt-4">
              <button onClick={saveActual} disabled={savingActual} className="px-6 py-2.5 rounded-lg border border-black/10 dark:border-white/10 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50">
                {savingActual ? 'Guardando...' : 'Guardar resultado'}
              </button>
            </div>
          </Block>
        )}
      </div>
    </Card>
  )
}

/* ==================== DAILY: EDIT FORM (dentro del calendario / modal) ==================== */
function DailyBiasEditForm({ entry, onCancel, onSaved }: { entry: DailyBiasEntry; onCancel: () => void; onSaved: (e: DailyBiasEntry) => void }) {
  const { upsertDailyBias } = useAppData()
  const { user } = useAuth()
  const uid = user!.uid

  const [symbol, setSymbol] = useState(entry.symbol || '')
  const [direction, setDirection] = useState<BiasDirection>(entry.expected_direction)
  const [expectedDesc, setExpectedDesc] = useState(entry.expected_description)
  const [expectedExisting, setExpectedExisting] = useState<string[]>(entry.expected_screenshots || [])
  const [expectedFiles, setExpectedFiles] = useState<File[]>([])
  const [outcome, setOutcome] = useState<BiasOutcome | ''>(entry.outcome || '')
  const [actualDesc, setActualDesc] = useState(entry.actual_description || '')
  const [actualExisting, setActualExisting] = useState<string[]>(entry.actual_screenshots || [])
  const [actualFiles, setActualFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      let expectedUrls = [...expectedExisting]
      if (expectedFiles.length) {
        const uploaded = await uploadBiasFiles(expectedFiles, `users/${uid}/bias/${entry.id}/expected`)
        expectedUrls = [...expectedUrls, ...uploaded]
      }
      let actualUrls = [...actualExisting]
      if (actualFiles.length) {
        const uploaded = await uploadBiasFiles(actualFiles, `users/${uid}/bias/${entry.id}/actual`)
        actualUrls = [...actualUrls, ...uploaded]
      }
      const updated: DailyBiasEntry = {
        ...entry,
        symbol: symbol.trim() || undefined,
        expected_direction: direction,
        expected_description: expectedDesc,
        expected_screenshots: expectedUrls,
        outcome: outcome || undefined,
        actual_description: actualDesc,
        actual_screenshots: actualUrls,
        updated_at: new Date().toISOString(),
      }
      upsertDailyBias(updated)
      onSaved(updated)
    } catch (err) {
      console.error('Error al guardar bias:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="serif text-2xl font-semibold mb-1">Editar Bias</h2>
      <p className="text-sm text-ink-900/50 dark:text-bone-100/50 -mt-4 mb-2">{entry.market} · {new Date(entry.date + 'T00:00:00').toLocaleDateString()}</p>

      <Block icon={CalendarDays} title="Contexto" first>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <Field label="Símbolo (opcional)"><input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="EURUSD, BTCUSD, NQ..." className={inputCls} /></Field>
        </div>
        <Field label="Dirección esperada">
          <div className="flex flex-wrap gap-2">
            {BIAS_DIRECTIONS.map(d => <ChipButton key={d} active={direction === d} onClick={() => setDirection(d)}>{d}</ChipButton>)}
          </div>
        </Field>
      </Block>

      <Block icon={FileText} title="Análisis y Expectativa">
        <Field label="¿Qué esperabas?"><textarea rows={4} value={expectedDesc} onChange={e => setExpectedDesc(e.target.value)} className={inputCls} /></Field>
        <div className="mt-4">
          <ScreenshotGrid urls={expectedExisting} onRemove={url => setExpectedExisting(prev => prev.filter(s => s !== url))} />
          <div className="mt-3"><ScreenshotUploader files={expectedFiles} onChange={setExpectedFiles} /></div>
        </div>
      </Block>

      <Block icon={CheckCircle2} title="Resultado Real">
        <Field label="Resultado">
          <div className="flex flex-wrap gap-2">
            {(['Acertado', 'Parcial', 'Fallado'] as BiasOutcome[]).map(o => <ChipButton key={o} active={outcome === o} onClick={() => setOutcome(o)}>{o}</ChipButton>)}
          </div>
        </Field>
        <Field label="¿Qué pasó realmente?"><textarea rows={4} value={actualDesc} onChange={e => setActualDesc(e.target.value)} className={inputCls} /></Field>
        <div className="mt-4">
          <ScreenshotGrid urls={actualExisting} onRemove={url => setActualExisting(prev => prev.filter(s => s !== url))} />
          <div className="mt-3"><ScreenshotUploader files={actualFiles} onChange={setActualFiles} /></div>
        </div>
      </Block>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">Cancelar</button>
        <button type="button" onClick={handleSave} disabled={saving} className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

/* ==================== DAILY: CALENDARIO ==================== */
type BiasDayColor = 'green' | 'yellow' | 'red' | 'none'
function getBiasDayColor(entries: DailyBiasEntry[]): BiasDayColor {
  if (!entries || entries.length === 0) return 'none'
  if (entries.some(e => e.outcome === 'Fallado')) return 'red'
  if (entries.some(e => !e.outcome || e.outcome === 'Parcial')) return 'yellow'
  return 'green'
}
const DAY_BG: Record<BiasDayColor, string> = {
  green: 'bg-profit/10 hover:bg-profit/20',
  yellow: 'bg-amber-400/10 hover:bg-amber-400/20',
  red: 'bg-loss/10 hover:bg-loss/20',
  none: 'bg-black/[0.03] dark:bg-white/[0.03] hover:bg-black/[0.05] dark:hover:bg-white/[0.05]',
}

function DailyBiasCalendar() {
  const { dailyBias, deleteDailyBias } = useAppData()
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const year = cursor.getFullYear(), month = cursor.getMonth()
  const weeks = useMemo(() => getMonthMatrix(year, month), [year, month])

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [viewingEntry, setViewingEntry] = useState<DailyBiasEntry | null>(null)
  const [itemMode, setItemMode] = useState<'view' | 'edit' | 'confirmDelete'>('view')

  const entriesByDate = useMemo(() => {
    const map: Record<string, DailyBiasEntry[]> = {}
    dailyBias.forEach(e => { (map[e.date] ||= []).push(e) })
    return map
  }, [dailyBias])

  const goPrev = () => setCursor(new Date(year, month - 1, 1))
  const goNext = () => setCursor(new Date(year, month + 1, 1))
  const goToday = () => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))

  const closeDayModal = () => { setSelectedDate(null); setViewingEntry(null); setItemMode('view') }
  const dayEntries = selectedDate ? (entriesByDate[selectedDate] || []) : []

  const confirmAndDelete = () => {
    if (!viewingEntry) return
    deleteDailyBias(viewingEntry.id)
    setViewingEntry(null)
    setItemMode('view')
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="serif text-xl font-semibold">{MONTHS_ES[month]} {year}</h3>
        <div className="flex items-center gap-2">
          <button onClick={goPrev} className="p-2 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"><ChevronLeft size={16} /></button>
          <button onClick={goToday} className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5">Hoy</button>
          <button onClick={goNext} className="p-2 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4 text-xs text-ink-900/50 dark:text-bone-100/50 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-profit inline-block" /> Acertado</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Parcial / pendiente</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-loss inline-block" /> Fallado</span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 gap-2 mb-2">
            {DAYS_ES.map(d => <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 py-2">{d}</div>)}
          </div>
          <div className="space-y-2">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-2">
                {week.map((d, di) => {
                  const inMonth = d.getMonth() === month
                  const iso = toISODate(d)
                  const entries = entriesByDate[iso] || []
                  const color = getBiasDayColor(entries)
                  const isToday = isSameDay(d, today)
                  return (
                    <button
                      key={di}
                      type="button"
                      onClick={() => entries.length > 0 && setSelectedDate(iso)}
                      className={`rounded-xl p-3 min-h-[70px] flex flex-col justify-between text-left transition ${!inMonth ? 'opacity-30' : ''} ${DAY_BG[color]} ${isToday ? 'ring-2 ring-accent' : ''} ${entries.length === 0 ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <span className="text-xs font-medium">{d.getDate()}</span>
                      {entries.length > 0 && (
                        <span className="text-[10px] font-semibold text-ink-900/60 dark:text-bone-100/60">{entries.length} bias</span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal open={!!selectedDate} onClose={closeDayModal} widthClass={itemMode === 'edit' ? 'max-w-3xl' : 'max-w-2xl'}>
        {selectedDate && !viewingEntry && (
          <div>
            <h2 className="serif text-2xl font-semibold mb-1">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
            <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-6">{dayEntries.length} bias registrado{dayEntries.length !== 1 ? 's' : ''} este día. Pulsa uno para ver el detalle.</p>
            <div className="space-y-3">
              {dayEntries.map(e => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => { setViewingEntry(e); setItemMode('view') }}
                  className="w-full text-left p-4 rounded-xl border border-black/5 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition"
                >
                  <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-black/5 dark:bg-white/10 text-ink-900/60 dark:text-bone-100/60">{e.market}</span>
                      {e.symbol && <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-accent/10 text-accent">{e.symbol}</span>}
                      <span className="text-xs font-medium text-ink-900/60 dark:text-bone-100/60">{e.expected_direction}</span>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${outcomeBadgeClass(e.outcome)}`}>{e.outcome || 'Pendiente'}</span>
                  </div>
                  <p className="text-xs text-ink-900/50 dark:text-bone-100/50 line-clamp-1">{e.expected_description || 'Sin descripción'}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {viewingEntry && itemMode === 'view' && (
          <div>
            <button onClick={() => setViewingEntry(null)} className="text-xs font-medium text-accent hover:underline mb-4">← Volver a los bias del día</button>
            <div className="flex items-start justify-between mb-6 pr-2 flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-bold px-2 py-1 rounded bg-black/5 dark:bg-white/10 text-ink-900/60 dark:text-bone-100/60">{viewingEntry.market}</span>
                  {viewingEntry.symbol && <span className="text-xs font-bold px-2 py-1 rounded bg-accent/10 text-accent">{viewingEntry.symbol}</span>}
                </div>
                <h2 className="serif text-2xl font-semibold">{new Date(viewingEntry.date + 'T00:00:00').toLocaleDateString()}</h2>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setItemMode('edit')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5">
                  <Pencil size={13} /> Editar
                </button>
                <button onClick={() => setItemMode('confirmDelete')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-loss/30 text-loss text-xs font-medium hover:bg-loss/10">
                  <Trash2 size={13} /> Eliminar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <MiniMetric label="Bias Esperado" value={viewingEntry.expected_direction} />
              <MiniMetric label="Resultado" value={viewingEntry.outcome || 'Pendiente'} />
            </div>

            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-1">Descripción y Análisis</p>
              <p className="text-sm whitespace-pre-wrap">{viewingEntry.expected_description || 'Sin descripción'}</p>
            </div>
            {viewingEntry.expected_screenshots && viewingEntry.expected_screenshots.length > 0 && (
              <div className="mb-6">
                <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-2">Screenshots</p>
                <ScreenshotGrid urls={viewingEntry.expected_screenshots} />
              </div>
            )}

            {viewingEntry.actual_description && (
              <div className="mb-6">
                <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-1">Qué Pasó Realmente</p>
                <p className="text-sm whitespace-pre-wrap">{viewingEntry.actual_description}</p>
              </div>
            )}
            {viewingEntry.actual_screenshots && viewingEntry.actual_screenshots.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-2">Screenshots del Resultado</p>
                <ScreenshotGrid urls={viewingEntry.actual_screenshots} />
              </div>
            )}
          </div>
        )}

        {viewingEntry && itemMode === 'edit' && (
          <DailyBiasEditForm
            entry={viewingEntry}
            onCancel={() => setItemMode('view')}
            onSaved={(updated) => { setViewingEntry(updated); setItemMode('view') }}
          />
        )}

        {viewingEntry && itemMode === 'confirmDelete' && (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-loss/10 text-loss flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={26} />
            </div>
            <h2 className="serif text-xl font-semibold mb-2">¿Eliminar este bias?</h2>
            <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-6">
              Estás a punto de eliminar el bias de <strong>{viewingEntry.market}{viewingEntry.symbol ? ` (${viewingEntry.symbol})` : ''}</strong> del {new Date(viewingEntry.date + 'T00:00:00').toLocaleDateString()}. Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setItemMode('view')} className="px-5 py-2.5 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">Cancelar</button>
              <button onClick={confirmAndDelete} className="px-5 py-2.5 rounded-lg bg-loss text-white text-sm font-semibold hover:opacity-90">Sí, eliminar</button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}

/* ==================== BIAS PAGE (default export) ==================== */
export default function BiasPage() {
  const [tab, setTab] = useState<'new' | 'history'>('new')
  const [market, setMarket] = useState<BiasMarket>('Futuros')

  return (
    <div>
      <SectionHeader eyebrow="Bias" title="Bias" subtitle="Registra lo que esperas del mercado cada día y compáralo con lo que realmente ocurrió." />

      <div className="mb-6">
        <PillTabs tabs={[{ id: 'new', label: 'Nuevo Bias' }, { id: 'history', label: '📅 Historial' }]} active={tab} onChange={v => setTab(v as any)} />
      </div>

      {tab === 'new' && (
        <>
          <div className="flex items-center gap-2 mb-6">
            {BIAS_MARKETS.map(m => <ChipButton key={m} active={market === m} onClick={() => setMarket(m)}>{m}</ChipButton>)}
          </div>
          <DailyBiasForm market={market} />
        </>
      )}

      {tab === 'history' && <DailyBiasCalendar />}
    </div>
  )
}