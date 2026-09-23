import React, { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays, Compass, FileText, Paperclip, CheckCircle2, Pencil, Trash2, AlertTriangle,
} from 'lucide-react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase'
import { useAppData, useAuth } from '../contexts'
import { todayISO, getSunday, toISODate } from '../utils'
import type { BiasMarket, BiasDirection, BiasOutcome, DailyBiasEntry, WeeklyOutlookEntry } from '../types'
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
      setDirection(currentEntry.expected_direction)
      setExpectedDesc(currentEntry.expected_description)
      setActualDesc(currentEntry.actual_description || '')
      setOutcome(currentEntry.outcome || '')
    } else {
      setDirection('Sin sesgo'); setExpectedDesc(''); setActualDesc(''); setOutcome('')
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
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center"><span className="text-lg font-bold">+</span></div>
        <h2 className="serif text-2xl font-semibold">Registrar Bias — {market}</h2>
      </div>
      <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-8 ml-12">Define tu expectativa del día y, cuando el mercado cierre, registra qué pasó realmente.</p>

      <div className="space-y-10">
        <Block icon={CalendarDays} title="Fecha" first>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <Field label="Fecha"><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} /></Field>
            {currentEntry?.outcome && (
              <span className={`text-xs font-bold uppercase px-3 py-1.5 rounded-full ${currentEntry.outcome === 'Acertado' ? 'bg-profit/10 text-profit' : currentEntry.outcome === 'Fallado' ? 'bg-loss/10 text-loss' : 'bg-black/5 dark:bg-white/10 text-ink-900/60 dark:text-bone-100/60'}`}>{currentEntry.outcome}</span>
            )}
          </div>
        </Block>

        <Block icon={Compass} title="Lo que Espero">
          <div className="flex flex-wrap gap-2">
            {BIAS_DIRECTIONS.map(d => <ChipButton key={d} active={direction === d} onClick={() => setDirection(d)}>{d}</ChipButton>)}
          </div>
        </Block>

        <Block icon={FileText} title="Descripción y Análisis">
          <Field label="¿Qué esperas hoy?"><textarea rows={4} value={expectedDesc} onChange={e => setExpectedDesc(e.target.value)} placeholder="Niveles, estructura, catalizadores..." className={inputCls} /></Field>
        </Block>

        <Block icon={Paperclip} title="Screenshots">
          <ScreenshotUploader files={expectedFiles} onChange={setExpectedFiles} />
          <div className="mt-3"><ScreenshotGrid urls={currentEntry?.expected_screenshots || []} /></div>
          <div className="flex justify-end pt-4">
            <button onClick={saveExpected} disabled={savingExpected} className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light disabled:opacity-50">
              {savingExpected ? 'Guardando...' : 'Guardar expectativa'}
            </button>
          </div>
        </Block>

        {currentEntry && (
          <>
            <Block icon={CheckCircle2} title="Resultado">
              <div className="flex flex-wrap gap-2">
                {(['Acertado', 'Parcial', 'Fallado'] as BiasOutcome[]).map(o => <ChipButton key={o} active={outcome === o} onClick={() => setOutcome(o)}>{o}</ChipButton>)}
              </div>
            </Block>

            <Block icon={FileText} title="Qué Pasó Realmente">
              <Field label="Descripción"><textarea rows={4} value={actualDesc} onChange={e => setActualDesc(e.target.value)} placeholder="Describe cómo se comportó el mercado frente a tu expectativa..." className={inputCls} /></Field>
            </Block>

            <Block icon={Paperclip} title="Screenshots del Resultado">
              <ScreenshotUploader files={actualFiles} onChange={setActualFiles} />
              <div className="mt-3"><ScreenshotGrid urls={currentEntry?.actual_screenshots || []} /></div>
              <div className="flex justify-end pt-4">
                <button onClick={saveActual} disabled={savingActual} className="px-6 py-2.5 rounded-lg border border-black/10 dark:border-white/10 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50">
                  {savingActual ? 'Guardando...' : 'Guardar resultado'}
                </button>
              </div>
            </Block>
          </>
        )}
      </div>
    </Card>
  )
}

/* ==================== DAILY: EDIT FORM (dentro del modal de historial) ==================== */
function DailyBiasEditForm({ entry, onCancel, onSaved }: { entry: DailyBiasEntry; onCancel: () => void; onSaved: (e: DailyBiasEntry) => void }) {
  const { upsertDailyBias } = useAppData()
  const { user } = useAuth()
  const uid = user!.uid

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
    <div className="space-y-8">
      <h2 className="serif text-2xl font-semibold mb-1">Editar Bias</h2>
      <p className="text-sm text-ink-900/50 dark:text-bone-100/50 -mt-6 mb-2">{entry.market} · {new Date(entry.date + 'T00:00:00').toLocaleDateString()}</p>

      <Block icon={Compass} title="Lo que Espero" first>
        <div className="flex flex-wrap gap-2">
          {BIAS_DIRECTIONS.map(d => <ChipButton key={d} active={direction === d} onClick={() => setDirection(d)}>{d}</ChipButton>)}
        </div>
      </Block>

      <Block icon={FileText} title="Descripción y Análisis">
        <Field label="¿Qué esperabas?"><textarea rows={4} value={expectedDesc} onChange={e => setExpectedDesc(e.target.value)} className={inputCls} /></Field>
      </Block>

      <Block icon={Paperclip} title="Screenshots">
        <ScreenshotGrid urls={expectedExisting} onRemove={url => setExpectedExisting(prev => prev.filter(s => s !== url))} />
        <div className="mt-3"><ScreenshotUploader files={expectedFiles} onChange={setExpectedFiles} /></div>
      </Block>

      <Block icon={CheckCircle2} title="Resultado">
        <div className="flex flex-wrap gap-2">
          {(['Acertado', 'Parcial', 'Fallado'] as BiasOutcome[]).map(o => <ChipButton key={o} active={outcome === o} onClick={() => setOutcome(o)}>{o}</ChipButton>)}
        </div>
      </Block>

      <Block icon={FileText} title="Qué Pasó Realmente">
        <Field label="Descripción"><textarea rows={4} value={actualDesc} onChange={e => setActualDesc(e.target.value)} className={inputCls} /></Field>
      </Block>

      <Block icon={Paperclip} title="Screenshots del Resultado">
        <ScreenshotGrid urls={actualExisting} onRemove={url => setActualExisting(prev => prev.filter(s => s !== url))} />
        <div className="mt-3"><ScreenshotUploader files={actualFiles} onChange={setActualFiles} /></div>
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

/* ==================== DAILY: HISTORIAL ==================== */
function DailyBiasHistory({ market }: { market: BiasMarket }) {
  const { dailyBias, deleteDailyBias } = useAppData()
  const [selected, setSelected] = useState<DailyBiasEntry | null>(null)
  const [itemMode, setItemMode] = useState<'view' | 'edit' | 'confirmDelete'>('view')

  const marketHistory = useMemo(() => dailyBias.filter(e => e.market === market).sort((a, b) => b.date.localeCompare(a.date)), [dailyBias, market])

  const openEntry = (e: DailyBiasEntry) => { setSelected(e); setItemMode('view') }
  const closeModal = () => { setSelected(null); setItemMode('view') }
  const confirmAndDelete = () => {
    if (!selected) return
    deleteDailyBias(selected.id)
    closeModal()
  }

  return (
    <Card className="p-6">
      <h3 className="serif text-xl font-semibold mb-4">Histórico — {market}</h3>
      {marketHistory.length === 0 ? (
        <p className="text-sm text-ink-900/40 dark:text-bone-100/40 py-10 text-center">Aún no tienes registros para este mercado.</p>
      ) : (
        <div className="space-y-3">
          {marketHistory.map(e => (
            <div key={e.id} className="p-4 rounded-xl border border-black/5 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer" onClick={() => openEntry(e)}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">{new Date(e.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-black/5 dark:bg-white/10 text-ink-900/60 dark:text-bone-100/60">{e.expected_direction}</span>
                  {e.outcome && <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${e.outcome === 'Acertado' ? 'bg-profit/10 text-profit' : e.outcome === 'Fallado' ? 'bg-loss/10 text-loss' : 'bg-black/5 dark:bg-white/10 text-ink-900/60 dark:text-bone-100/60'}`}>{e.outcome}</span>}
                </div>
              </div>
              <p className="text-xs text-ink-900/50 dark:text-bone-100/50 line-clamp-1">{e.expected_description || 'Sin descripción'}</p>
              {e.actual_description && <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mt-1 line-clamp-1">→ {e.actual_description}</p>}
            </div>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={closeModal} widthClass={itemMode === 'edit' ? 'max-w-4xl' : 'max-w-2xl'}>
        {selected && itemMode === 'view' && (
          <div>
            <div className="flex items-start justify-between mb-6 pr-8">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs font-bold px-2 py-1 rounded bg-black/5 dark:bg-white/10 text-ink-900/60 dark:text-bone-100/60">{selected.market}</span>
                  <h2 className="serif text-2xl font-semibold">{new Date(selected.date + 'T00:00:00').toLocaleDateString()}</h2>
                </div>
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
              <MiniMetric label="Bias Esperado" value={selected.expected_direction} />
              <MiniMetric label="Resultado" value={selected.outcome || '—'} />
            </div>

            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-1">Descripción y Análisis</p>
              <p className="text-sm whitespace-pre-wrap">{selected.expected_description || 'Sin descripción'}</p>
            </div>
            {selected.expected_screenshots && selected.expected_screenshots.length > 0 && (
              <div className="mb-6">
                <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-2">Screenshots</p>
                <ScreenshotGrid urls={selected.expected_screenshots} />
              </div>
            )}

            {selected.actual_description && (
              <div className="mb-6">
                <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-1">Qué Pasó Realmente</p>
                <p className="text-sm whitespace-pre-wrap">{selected.actual_description}</p>
              </div>
            )}
            {selected.actual_screenshots && selected.actual_screenshots.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-2">Screenshots del Resultado</p>
                <ScreenshotGrid urls={selected.actual_screenshots} />
              </div>
            )}
          </div>
        )}

        {selected && itemMode === 'edit' && (
          <DailyBiasEditForm entry={selected} onCancel={() => setItemMode('view')} onSaved={(updated) => { setSelected(updated); setItemMode('view') }} />
        )}

        {selected && itemMode === 'confirmDelete' && (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-loss/10 text-loss flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={26} />
            </div>
            <h2 className="serif text-xl font-semibold mb-2">¿Eliminar este bias?</h2>
            <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-6">
              Estás a punto de eliminar el bias de <strong>{selected.market}</strong> del {new Date(selected.date + 'T00:00:00').toLocaleDateString()}. Esta acción no se puede deshacer.
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

/* ==================== WEEKLY: NUEVO BIAS ==================== */
function WeeklyBiasForm({ market }: { market: BiasMarket }) {
  const { weeklyOutlooks, upsertWeeklyOutlook } = useAppData()
  const { user } = useAuth()
  const uid = user!.uid

  const [weekStart, setWeekStart] = useState(() => toISODate(getSunday(new Date())))
  const [weekDesc, setWeekDesc] = useState('')
  const [weekFiles, setWeekFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  const currentEntry = useMemo(() => weeklyOutlooks.find(e => e.week_start === weekStart && e.market === market), [weeklyOutlooks, weekStart, market])

  useEffect(() => {
    setWeekDesc(currentEntry ? currentEntry.description : '')
    setWeekFiles([])
  }, [weekStart, market]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveWeekly = async () => {
    setSaving(true)
    try {
      const base: WeeklyOutlookEntry = currentEntry ? { ...currentEntry } : {
        id: crypto.randomUUID(), week_start: weekStart, market, description: weekDesc, created_at: new Date().toISOString(),
      }
      base.description = weekDesc
      if (weekFiles.length) {
        const urls = await uploadBiasFiles(weekFiles, `users/${uid}/bias-weekly/${base.id}`)
        base.screenshots = [...(base.screenshots || []), ...urls]
      }
      upsertWeeklyOutlook(base)
      setWeekFiles([])
    } catch (err) {
      console.error('Error al guardar plan semanal:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-6 md:p-8">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center"><span className="text-lg font-bold">+</span></div>
        <h2 className="serif text-2xl font-semibold">Plan Semanal — {market}</h2>
      </div>
      <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-8 ml-12">Escribe tu plan cada domingo para la semana que comienza.</p>

      <div className="space-y-10">
        <Block icon={CalendarDays} title="Semana" first>
          <Field label="Domingo de inicio">
            <input type="date" value={weekStart} onChange={e => setWeekStart(toISODate(getSunday(new Date(e.target.value + 'T00:00:00'))))} className={inputCls} />
          </Field>
          <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mt-2">Semana que comienza el {new Date(weekStart + 'T00:00:00').toLocaleDateString()}.</p>
        </Block>

        <Block icon={FileText} title="Descripción y Análisis">
          <Field label={`Qué espero para ${market} esta semana`}><textarea rows={5} value={weekDesc} onChange={e => setWeekDesc(e.target.value)} placeholder="Sesgo semanal, niveles clave, eventos macro..." className={inputCls} /></Field>
        </Block>

        <Block icon={Paperclip} title="Screenshots">
          <ScreenshotUploader files={weekFiles} onChange={setWeekFiles} />
          <div className="mt-3"><ScreenshotGrid urls={currentEntry?.screenshots || []} /></div>
          <div className="flex justify-end pt-4">
            <button onClick={saveWeekly} disabled={saving} className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar plan semanal'}
            </button>
          </div>
        </Block>
      </div>
    </Card>
  )
}

/* ==================== WEEKLY: EDIT FORM ==================== */
function WeeklyBiasEditForm({ entry, onCancel, onSaved }: { entry: WeeklyOutlookEntry; onCancel: () => void; onSaved: (e: WeeklyOutlookEntry) => void }) {
  const { upsertWeeklyOutlook } = useAppData()
  const { user } = useAuth()
  const uid = user!.uid

  const [desc, setDesc] = useState(entry.description)
  const [existing, setExisting] = useState<string[]>(entry.screenshots || [])
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      let urls = [...existing]
      if (files.length) {
        const uploaded = await uploadBiasFiles(files, `users/${uid}/bias-weekly/${entry.id}`)
        urls = [...urls, ...uploaded]
      }
      const updated: WeeklyOutlookEntry = { ...entry, description: desc, screenshots: urls }
      upsertWeeklyOutlook(updated)
      onSaved(updated)
    } catch (err) {
      console.error('Error al guardar plan semanal:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <h2 className="serif text-2xl font-semibold mb-1">Editar Plan Semanal</h2>
      <p className="text-sm text-ink-900/50 dark:text-bone-100/50 -mt-6 mb-2">{entry.market} · Semana del {new Date(entry.week_start + 'T00:00:00').toLocaleDateString()}</p>

      <Block icon={FileText} title="Descripción y Análisis" first>
        <textarea rows={5} value={desc} onChange={e => setDesc(e.target.value)} className={inputCls} />
      </Block>

      <Block icon={Paperclip} title="Screenshots">
        <ScreenshotGrid urls={existing} onRemove={url => setExisting(prev => prev.filter(s => s !== url))} />
        <div className="mt-3"><ScreenshotUploader files={files} onChange={setFiles} /></div>
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

/* ==================== WEEKLY: HISTORIAL ==================== */
function WeeklyBiasHistory({ market }: { market: BiasMarket }) {
  const { weeklyOutlooks, deleteWeeklyOutlook } = useAppData()
  const [selected, setSelected] = useState<WeeklyOutlookEntry | null>(null)
  const [itemMode, setItemMode] = useState<'view' | 'edit' | 'confirmDelete'>('view')

  const weeklyHistory = useMemo(() => weeklyOutlooks.filter(e => e.market === market).sort((a, b) => b.week_start.localeCompare(a.week_start)), [weeklyOutlooks, market])

  const openEntry = (e: WeeklyOutlookEntry) => { setSelected(e); setItemMode('view') }
  const closeModal = () => { setSelected(null); setItemMode('view') }
  const confirmAndDelete = () => {
    if (!selected) return
    deleteWeeklyOutlook(selected.id)
    closeModal()
  }

  return (
    <Card className="p-6">
      <h3 className="serif text-xl font-semibold mb-4">Histórico Semanal — {market}</h3>
      {weeklyHistory.length === 0 ? (
        <p className="text-sm text-ink-900/40 dark:text-bone-100/40 py-10 text-center">Aún no tienes planes semanales para este mercado.</p>
      ) : (
        <div className="space-y-3">
          {weeklyHistory.map(e => (
            <div key={e.id} className="p-4 rounded-xl border border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02]" onClick={() => openEntry(e)}>
              <p className="text-sm font-medium mb-1">Semana del {new Date(e.week_start + 'T00:00:00').toLocaleDateString()}</p>
              <p className="text-xs text-ink-900/50 dark:text-bone-100/50 line-clamp-2">{e.description}</p>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={closeModal} widthClass={itemMode === 'edit' ? 'max-w-3xl' : 'max-w-xl'}>
        {selected && itemMode === 'view' && (
          <div>
            <div className="flex items-start justify-between mb-6 pr-8">
              <div>
                <span className="text-xs font-bold px-2 py-1 rounded bg-black/5 dark:bg-white/10 text-ink-900/60 dark:text-bone-100/60">{selected.market}</span>
                <h2 className="serif text-2xl font-semibold mt-2">Semana del {new Date(selected.week_start + 'T00:00:00').toLocaleDateString()}</h2>
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
            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-1">Descripción y Análisis</p>
              <p className="text-sm whitespace-pre-wrap">{selected.description}</p>
            </div>
            {selected.screenshots && selected.screenshots.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-2">Screenshots</p>
                <ScreenshotGrid urls={selected.screenshots} />
              </div>
            )}
          </div>
        )}

        {selected && itemMode === 'edit' && (
          <WeeklyBiasEditForm entry={selected} onCancel={() => setItemMode('view')} onSaved={(updated) => { setSelected(updated); setItemMode('view') }} />
        )}

        {selected && itemMode === 'confirmDelete' && (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-loss/10 text-loss flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={26} />
            </div>
            <h2 className="serif text-xl font-semibold mb-2">¿Eliminar este plan semanal?</h2>
            <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-6">
              Estás a punto de eliminar el plan de <strong>{selected.market}</strong> de la semana del {new Date(selected.week_start + 'T00:00:00').toLocaleDateString()}. Esta acción no se puede deshacer.
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
  const [mode, setMode] = useState<'daily' | 'weekly'>('daily')

  return (
    <div>
      <SectionHeader eyebrow="Bias" title="Bias Diario" subtitle="Registra lo que esperas del mercado cada día y compáralo con lo que realmente ocurrió." />

      <div className="mb-6">
        <PillTabs tabs={[{ id: 'new', label: 'Nuevo Bias' }, { id: 'history', label: 'Historial' }]} active={tab} onChange={v => setTab(v as any)} />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div className="flex gap-2">{BIAS_MARKETS.map(m => <ChipButton key={m} active={market === m} onClick={() => setMarket(m)}>{m}</ChipButton>)}</div>
        <PillTabs tabs={[{ id: 'daily', label: 'Diario' }, { id: 'weekly', label: 'Semanal (Domingos)' }]} active={mode} onChange={v => setMode(v as any)} />
      </div>

      {tab === 'new' ? (
        mode === 'daily' ? <DailyBiasForm market={market} /> : <WeeklyBiasForm market={market} />
      ) : (
        mode === 'daily' ? <DailyBiasHistory market={market} /> : <WeeklyBiasHistory market={market} />
      )}
    </div>
  )
}