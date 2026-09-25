import { useState, useRef } from 'react'
import {
  Bot, Send, Image as ImageIcon, X, Plus, Trash2, MessageSquare, AlertTriangle, ClipboardList,
} from 'lucide-react'
import { useAppData } from '../contexts'
import { computeMetrics } from '../calculations'
import { fmt } from '../utils'
import { Card, SectionHeader, PillTabs, Modal } from '../components/ui'
import type { Trade, Direction, ChatMessage, Conversation } from '../types'

/* ==================== MENTOR PERSONALITY (chat) ==================== */
const MENTOR_PERSONALITY = `
Eres "Nova", un mentor de trading experto, exigente pero motivador.
Tu estilo:
- Hablas claro, directo, como un trader profesional real, sin rodeos.
- Analizas price action, estructura de mercado, zonas de oferta/demanda,
  gestión de riesgo y psicología del trading.
- Nunca das certezas absolutas ni "señales", enseñas a pensar en probabilidades.
- Si detectas mala gestión de riesgo (sin stop loss, sobreapalancamiento,
  revenge trading, romper reglas del plan), lo señalas directamente y sin filtros.
- Usas los datos reales del trader (que se te proveen) para dar feedback
  personalizado, detectar patrones repetitivos y malos hábitos.
- Cuando analices una imagen de un gráfico o de una plataforma de trading,
  describe primero lo que ves objetivamente, luego da tu análisis.
- Terminas tus respuestas importantes con una pregunta que invite a la
  reflexión del alumno.
- Responde siempre en español.
`

const INITIAL_GREETING: ChatMessage = {
  role: 'assistant',
  content: '¡Hola! Soy Nova, tu mentor de trading. Puedo analizar tus operaciones, identificar patrones en tu comportamiento, revisar screenshots de tus gráficos y darte consejos personalizados basados en tus datos reales. ¿Qué quieres revisar hoy?'
}

function compressImage(file: File, maxWidth = 1024): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' })
      }
      img.onerror = reject
      img.src = e.target!.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const MODEL_FALLBACK_LIST = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-2.5-pro',
]

async function callGeminiWithFallback(apiKey: string, body: any): Promise<string> {
  let lastError = ''
  for (const model of MODEL_FALLBACK_LIST) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      )
      const data = await response.json()
      if (data.error) {
        lastError = data.error.message || 'Error desconocido'
        console.warn(`Modelo ${model} falló: ${lastError}`)
        continue
      }
      const respuesta = data.candidates?.[0]?.content?.parts?.[0]?.text
      if (respuesta) {
        console.log(`✅ Respuesta exitosa con modelo: ${model}`)
        return respuesta
      }
      lastError = 'Respuesta vacía del modelo'
    } catch (err: any) {
      lastError = err.message || 'Error de red'
      console.warn(`Modelo ${model} falló con excepción: ${lastError}`)
    }
  }
  throw new Error(`Todos los modelos fallaron. Último error: ${lastError}`)
}

/* ==================== EXTRACCIÓN DE TRADES DESDE BROKER ==================== */
const EXTRACTION_PROMPT = `Eres un extractor de datos. NO hagas cálculos matemáticos ni interpretes resultados, SOLO extrae y normaliza el texto tal cual aparece.

El usuario pegará datos de operaciones de Forex exportadas de su broker (formato tipo MetaTrader).
El formato típico tiene estas columnas, en este orden (pueden venir como tabla con encabezados una sola vez seguidos de varios bloques de valores):

Acción, Puesto, Volumen, Símbolo, Fecha de apertura, Fecha de cierre, Beneficio, Comisión, Intercambio, Precio medio Comprar, Precio medio de venta, Stop Loss, Cierre con ganancias

Notas importantes de mapeo:
- "Intercambio" = swap
- "Cierre con ganancias" = take profit
- Puede haber UNA o VARIAS operaciones en el texto. Devuelve un array con una entrada por cada operación.

Reglas de normalización de números:
- Elimina símbolos "$" y espacios.
- Si el número usa coma (,) como separador decimal, conviértela a punto (.). Ejemplo: "-1,50 $" -> -1.50
- Si ya usa punto como separador decimal, déjalo igual. Ejemplo: "$1.16156" -> 1.16156
- Mantén el signo negativo si existe.
- Si un campo es "-" o está vacío, devuélvelo como null.

Reglas de fechas:
- Devuélvelas EXACTAMENTE como aparecen en el texto original, sin modificar el formato (ejemplo: "08-09-2026 07:31:45").

TEXTO A PROCESAR:
"""
{RAW_TEXT}
"""`

const EXTRACTION_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      accion: { type: 'STRING' },
      puesto: { type: 'STRING' },
      volumen: { type: 'NUMBER' },
      simbolo: { type: 'STRING' },
      fecha_apertura: { type: 'STRING' },
      fecha_cierre: { type: 'STRING' },
      beneficio: { type: 'NUMBER' },
      comision: { type: 'NUMBER' },
      intercambio: { type: 'NUMBER' },
      precio_medio_comprar: { type: 'NUMBER' },
      precio_medio_venta: { type: 'NUMBER' },
      stop_loss: { type: 'NUMBER', nullable: true },
      take_profit: { type: 'NUMBER', nullable: true },
    },
    required: ['accion', 'volumen', 'simbolo', 'fecha_apertura', 'fecha_cierre', 'beneficio', 'precio_medio_comprar', 'precio_medio_venta'],
  },
}

async function extractTradesFromText(apiKey: string, rawText: string): Promise<any[]> {
  const body = {
    contents: [{ role: 'user', parts: [{ text: EXTRACTION_PROMPT.replace('{RAW_TEXT}', rawText) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: EXTRACTION_SCHEMA,
    },
  }
  const raw = await callGeminiWithFallback(apiKey, body)
  return JSON.parse(raw)
}

/* ==================== HELPERS DE PARSEO (100% en código, sin IA) ==================== */
function parseBrokerDate(raw: string | null): string {
  if (!raw) return new Date().toISOString()
  const match = raw.match(/(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return new Date().toISOString()
  const [, dd, mm, yyyy, hh, min, ss] = match
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss || 0))
  return date.toISOString()
}

interface PreviewTrade {
  tempId: string
  symbol: string
  direction: Direction
  entry_price: number
  exit_price: number
  position_size: number
  pnl: number
  stop_loss?: number
  take_profit?: number
  entry_datetime: string
  exit_datetime: string
  notes: string
}

function rawToPreview(raw: any): PreviewTrade {
  const isBuy = (raw.accion || '').toLowerCase().startsWith('compr')
  const entry_price = isBuy ? raw.precio_medio_comprar : raw.precio_medio_venta
  const exit_price = isBuy ? raw.precio_medio_venta : raw.precio_medio_comprar
  const comision = raw.comision || 0
  const swap = raw.intercambio || 0
  const beneficio = raw.beneficio || 0
  const pnl = Number((beneficio + comision + swap).toFixed(2))
  const symbol = (raw.simbolo || '').replace('/', '').toUpperCase()

  const notesParts: string[] = []
  if (raw.puesto) notesParts.push(`ID posición: ${raw.puesto}`)
  notesParts.push(`Beneficio bruto: ${fmt(beneficio)}`)
  if (comision) notesParts.push(`Comisión: ${fmt(comision)}`)
  if (swap) notesParts.push(`Swap: ${fmt(swap)}`)
  notesParts.push('Registrado vía Nova IA')

  return {
    tempId: crypto.randomUUID(),
    symbol,
    direction: isBuy ? 'long' : 'short',
    entry_price,
    exit_price,
    position_size: raw.volumen || 0,
    pnl,
    stop_loss: raw.stop_loss ?? undefined,
    take_profit: raw.take_profit ?? undefined,
    entry_datetime: parseBrokerDate(raw.fecha_apertura),
    exit_datetime: parseBrokerDate(raw.fecha_cierre),
    notes: notesParts.join(' · '),
  }
}

/* ==================== TAB: REGISTRAR OPERACIÓN ==================== */
function RegisterTradeTab() {
  const { addTrade } = useAppData()
  const [rawText, setRawText] = useState('')
  const [previews, setPreviews] = useState<PreviewTrade[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const handleInterpret = async () => {
    if (!rawText.trim()) return
    setLoading(true)
    setError('')
    setSaved(false)
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      const rawTrades = await extractTradesFromText(apiKey, rawText)
      const parsed = rawTrades.map(rawToPreview)
      setPreviews(parsed)
    } catch (err: any) {
      setError(err.message || 'No se pudo interpretar el texto. Revisa el formato e inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const updatePreview = (tempId: string, patch: Partial<PreviewTrade>) => {
    setPreviews(prev => prev.map(p => (p.tempId === tempId ? { ...p, ...patch } : p)))
  }
  const removePreview = (tempId: string) => {
    setPreviews(prev => prev.filter(p => p.tempId !== tempId))
  }

  const handleConfirmAll = () => {
    previews.forEach(p => {
      const trade: Trade = {
        id: crypto.randomUUID(),
        symbol: p.symbol,
        instrument_type: 'Forex',
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
        notes: p.notes,
        created_at: new Date().toISOString(),
      }
      addTrade(trade)
    })
    setPreviews([])
    setRawText('')
    setSaved(true)
    setTimeout(() => setSaved(false), 4000)
  }

  return (
    <Card className="flex-1 p-6 overflow-y-auto">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
          <ClipboardList size={18} />
        </div>
        <div>
          <h2 className="serif text-xl font-semibold">Registrar operación con Nova</h2>
          <p className="text-xs text-ink-900/50 dark:text-bone-100/50">Pega los datos tal cual te los da tu broker. Puedes pegar varias operaciones a la vez.</p>
        </div>
      </div>

      <textarea
        value={rawText}
        onChange={e => setRawText(e.target.value)}
        rows={8}
        placeholder="Pega aquí la tabla de tu broker (Acción, Puesto, Volumen, Símbolo, Fechas, Beneficio, Comisión, Intercambio, Precios, SL, TP...)"
        className="w-full bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-4 py-3 text-sm font-mono mb-3"
      />

      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={handleInterpret}
          disabled={loading || !rawText.trim()}
          className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light disabled:opacity-50"
        >
          {loading ? 'Interpretando...' : 'Interpretar con Nova'}
        </button>
        {error && <p className="text-sm text-loss">{error}</p>}
        {saved && <p className="text-sm text-profit">✅ Operaciones guardadas en tu historial.</p>}
      </div>

      {previews.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-ink-900/70 dark:text-bone-100/70">
            {previews.length} operación(es) detectada(s) — revisa y confirma antes de guardar
          </h3>
          {previews.map(p => (
            <div key={p.tempId} className="border border-black/10 dark:border-white/10 rounded-xl p-4 relative">
              <button
                onClick={() => removePreview(p.tempId)}
                className="absolute top-3 right-3 text-ink-900/30 hover:text-loss dark:text-bone-100/30"
              >
                <X size={16} />
              </button>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] text-ink-900/40 dark:text-bone-100/40">Símbolo</label>
                  <input value={p.symbol} onChange={e => updatePreview(p.tempId, { symbol: e.target.value.toUpperCase() })}
                    className="w-full bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-ink-900/40 dark:text-bone-100/40">Dirección</label>
                  <div className="flex gap-1 mt-0.5">
                    <button type="button" onClick={() => updatePreview(p.tempId, { direction: 'long' })}
                      className={`flex-1 text-xs py-1.5 rounded-lg font-semibold ${p.direction === 'long' ? 'bg-profit/10 text-profit' : 'bg-black/5 dark:bg-white/5 text-ink-900/50 dark:text-bone-100/50'}`}>LONG</button>
                    <button type="button" onClick={() => updatePreview(p.tempId, { direction: 'short' })}
                      className={`flex-1 text-xs py-1.5 rounded-lg font-semibold ${p.direction === 'short' ? 'bg-loss/10 text-loss' : 'bg-black/5 dark:bg-white/5 text-ink-900/50 dark:text-bone-100/50'}`}>SHORT</button>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-ink-900/40 dark:text-bone-100/40">Volumen</label>
                  <input type="number" step="0.01" value={p.position_size} onChange={e => updatePreview(p.tempId, { position_size: Number(e.target.value) })}
                    className="w-full bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-ink-900/40 dark:text-bone-100/40">P&L Neto $</label>
                  <input type="number" step="0.01" value={p.pnl} onChange={e => updatePreview(p.tempId, { pnl: Number(e.target.value) })}
                    className={`w-full bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm font-semibold ${p.pnl >= 0 ? 'text-profit' : 'text-loss'}`} />
                </div>
                <div>
                  <label className="text-[11px] text-ink-900/40 dark:text-bone-100/40">Precio Entrada</label>
                  <input type="number" step="0.00001" value={p.entry_price} onChange={e => updatePreview(p.tempId, { entry_price: Number(e.target.value) })}
                    className="w-full bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-ink-900/40 dark:text-bone-100/40">Precio Salida</label>
                  <input type="number" step="0.00001" value={p.exit_price} onChange={e => updatePreview(p.tempId, { exit_price: Number(e.target.value) })}
                    className="w-full bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-ink-900/40 dark:text-bone-100/40">Stop Loss</label>
                  <input type="number" step="0.00001" value={p.stop_loss ?? ''} onChange={e => updatePreview(p.tempId, { stop_loss: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-ink-900/40 dark:text-bone-100/40">Take Profit</label>
                  <input type="number" step="0.00001" value={p.take_profit ?? ''} onChange={e => updatePreview(p.tempId, { take_profit: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm" />
                </div>
              </div>
              <p className="text-[11px] text-ink-900/40 dark:text-bone-100/40 mt-3">
                {new Date(p.entry_datetime).toLocaleString()} → {new Date(p.exit_datetime).toLocaleString()}
              </p>
              <p className="text-[11px] text-ink-900/30 dark:text-bone-100/30 mt-1">{p.notes}</p>
            </div>
          ))}

          <div className="flex justify-end pt-2">
            <button
              onClick={handleConfirmAll}
              className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light"
            >
              Confirmar y guardar {previews.length} operación(es)
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

/* ==================== TAB: CHAT ==================== */
function ChatTab() {
  const { trades, settings, conversations, upsertConversation, deleteConversation } = useAppData()
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_GREETING])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedImage(file)
    setImagePreview(URL.createObjectURL(file))
  }
  const clearImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const startNewConversation = () => {
    setMessages([INITIAL_GREETING])
    setActiveConversationId(null)
    clearImage()
    setInput('')
  }

  const openConversation = (conv: Conversation) => {
    setMessages(conv.messages)
    setActiveConversationId(conv.id)
    clearImage()
    setInput('')
  }

  const confirmDelete = () => {
    if (!deletingId) return
    deleteConversation(deletingId)
    if (activeConversationId === deletingId) startNewConversation()
    setDeletingId(null)
  }

  const send = async () => {
    if ((!input.trim() && !selectedImage) || loading) return
    const userMessage = input
    const currentImagePreview = imagePreview || undefined
    const currentImageFile = selectedImage

    const updatedMessages: ChatMessage[] = [...messages, { role: 'user', content: userMessage, imagePreview: currentImagePreview }]
    setMessages(updatedMessages)
    setInput('')
    clearImage()
    setLoading(true)

    try {
      const metrics = computeMetrics(trades, settings)
      const resumenTrades = trades.slice(0, 20).map(t => ({
        symbol: t.symbol, direction: t.direction, pnl: t.pnl, fecha: t.exit_datetime, setup: t.custom_setup, notas: t.notes,
      }))

      const contexto = `
CONTEXTO DEL TRADER (usa esto para personalizar tu respuesta):
- Total de trades: ${trades.length}
- Net P&L: ${fmt(metrics.netPnl)}
- Win Rate: ${metrics.winRate}%
- Profit Factor: ${metrics.profitFactor}

ÚLTIMOS TRADES (máx 20):
${JSON.stringify(resumenTrades, null, 2)}

PREGUNTA DEL TRADER: ${userMessage || '(el trader envió una imagen sin texto, analízala)'}
      `

      const currentParts: any[] = [{ text: contexto }]
      if (currentImageFile) {
        const { base64, mimeType } = await compressImage(currentImageFile)
        currentParts.push({ inlineData: { mimeType, data: base64 } })
      }

      const history = messages.slice(1).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content || '(imagen enviada)' }],
      }))

      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      const body = {
        systemInstruction: { parts: [{ text: MENTOR_PERSONALITY }] },
        contents: [...history, { role: 'user', parts: currentParts }],
      }

      const respuesta = await callGeminiWithFallback(apiKey, body)
      const finalMessages: ChatMessage[] = [...updatedMessages, { role: 'assistant', content: respuesta }]
      setMessages(finalMessages)

      const now = new Date().toISOString()
      if (activeConversationId) {
        const existing = conversations.find(c => c.id === activeConversationId)
        upsertConversation({
          id: activeConversationId,
          title: existing?.title || userMessage.slice(0, 45),
          messages: finalMessages,
          created_at: existing?.created_at || now,
          updated_at: now,
        })
      } else {
        const newId = crypto.randomUUID()
        const title = userMessage.trim() ? (userMessage.slice(0, 45) + (userMessage.length > 45 ? '…' : '')) : 'Análisis de imagen'
        upsertConversation({ id: newId, title, messages: finalMessages, created_at: now, updated_at: now })
        setActiveConversationId(newId)
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Error al conectar con la IA: ${err.message || 'inténtalo de nuevo.'}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex gap-4 overflow-hidden">
      {/* Sidebar de conversaciones */}
      <div className="w-64 flex-shrink-0 flex flex-col bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-xl overflow-hidden">
        <div className="p-3 border-b border-black/10 dark:border-white/10">
          <button
            onClick={startNewConversation}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-light"
          >
            <Plus size={14} /> Nueva conversación
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 && (
            <p className="text-xs text-ink-900/30 dark:text-bone-100/30 text-center py-6 px-2">Aún no tienes conversaciones guardadas.</p>
          )}
          {conversations.map(c => (
            <div
              key={c.id}
              onClick={() => openConversation(c)}
              className={`group flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm ${
                activeConversationId === c.id ? 'bg-accent/10 text-accent' : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <MessageSquare size={14} className="mt-0.5 flex-shrink-0 opacity-50" />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{c.title}</p>
                <p className="text-[10px] opacity-40">{new Date(c.updated_at).toLocaleDateString()}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setDeletingId(c.id) }}
                className="opacity-0 group-hover:opacity-100 text-ink-900/30 hover:text-loss dark:text-bone-100/30 flex-shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat principal */}
      <Card className="flex-1 p-6 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.map((m, i) => (
            <div key={i} className={`max-w-lg p-3 rounded-xl text-sm whitespace-pre-wrap ${m.role === 'assistant' ? 'bg-accent/10' : 'bg-black/5 dark:bg-white/5 ml-auto'}`}>
              {m.imagePreview && <img src={m.imagePreview} alt="chart" className="rounded-lg mb-2 max-h-56" />}
              {m.content}
            </div>
          ))}
          {loading && <div className="max-w-lg p-3 rounded-xl text-sm bg-accent/10 animate-pulse">Analizando...</div>}
        </div>

        {imagePreview && (
          <div className="relative w-fit mb-3">
            <img src={imagePreview} className="h-20 rounded-lg border border-black/10 dark:border-white/10" />
            <button onClick={clearImage} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
              <X size={12} />
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={loading}
            className="px-3 rounded-lg bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 disabled:opacity-50" title="Subir imagen de tu gráfico">
            <ImageIcon size={16} />
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Pregúntame sobre tu trading o sube un gráfico..."
            disabled={loading}
            className="flex-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm disabled:opacity-50"
          />
          <button onClick={send} disabled={loading} className="px-4 rounded-lg bg-accent text-white disabled:opacity-50">
            <Send size={16} />
          </button>
        </div>
      </Card>

      <Modal open={!!deletingId} onClose={() => setDeletingId(null)}>
        <div className="text-center py-6">
          <div className="w-14 h-14 rounded-full bg-loss/10 text-loss flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={26} />
          </div>
          <h2 className="serif text-xl font-semibold mb-2">¿Eliminar esta conversación?</h2>
          <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-6">Esta acción no se puede deshacer.</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => setDeletingId(null)} className="px-5 py-2.5 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">Cancelar</button>
            <button onClick={confirmDelete} className="px-5 py-2.5 rounded-lg bg-loss text-white text-sm font-semibold hover:opacity-90">Sí, eliminar</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ==================== PAGE (default export) ==================== */
export default function AIChatPage() {
  const [tab, setTab] = useState('chat')
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <SectionHeader
        eyebrow="Herramientas"
        title="Nova IA"
        subtitle="Tu mentor de trading personal impulsado por IA."
        right={<Bot className="text-accent" size={28} />}
      />
      <div className="mb-4">
        <PillTabs
          tabs={[{ id: 'chat', label: 'Chat con Nova' }, { id: 'register', label: 'Registrar Operación' }]}
          active={tab}
          onChange={setTab}
        />
      </div>
      {tab === 'chat' ? <ChatTab /> : <RegisterTradeTab />}
    </div>
  )
}