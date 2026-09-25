import { useState, useRef } from 'react'
import {
  Bot, Send, Image as ImageIcon, X, Plus, Trash2, MessageSquare, AlertTriangle, ClipboardList,
  User, Sparkles, CheckCircle2, Wallet,
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

/* ==================== EXTRACCIÓN DE TRADES DESDE BROKER (+ autodetección de cuenta) ==================== */
const EXTRACTION_PROMPT = `Eres un extractor de datos. NO hagas cálculos matemáticos ni interpretes resultados, SOLO extrae y normaliza el texto tal cual aparece.

El usuario pegará datos de operaciones de Forex exportadas de su broker (formato tipo MetaTrader).
El formato típico tiene estas columnas, en este orden (pueden venir como tabla con encabezados una sola vez seguidos de varios bloques de valores):

Acción, Puesto, Volumen, Símbolo, Fecha de apertura, Fecha de cierre, Beneficio, Comisión, Intercambio, Precio medio Comprar, Precio medio de venta, Stop Loss, Cierre con ganancias

Notas importantes de mapeo:
- "Intercambio" = swap
- "Cierre con ganancias" = take profit
- Puede haber UNA o VARIAS operaciones en el texto. Devuelve un array con una entrada por cada operación dentro del campo "trades".

Reglas de normalización de números:
- Elimina símbolos "$" y espacios.
- Si el número usa coma (,) como separador decimal, conviértela a punto (.). Ejemplo: "-1,50 $" -> -1.50
- Si ya usa punto como separador decimal, déjalo igual. Ejemplo: "$1.16156" -> 1.16156
- Mantén el signo negativo si existe.
- Si un campo es "-" o está vacío, devuélvelo como null.

Reglas de fechas:
- Devuélvelas EXACTAMENTE como aparecen en el texto original, sin modificar el formato (ejemplo: "08-09-2026 07:31:45").

DETECCIÓN DE CUENTA:
El usuario puede mencionar de forma natural, en cualquier parte del texto, a qué cuenta pertenecen estas operaciones.
Ejemplos: "esto es de mi cuenta funded de forex", "cuenta demo FTMO", "operé con la cuenta real".

Estas son las cuentas disponibles del usuario (compara por similitud de nombre, no hace falta coincidencia exacta):
{ACCOUNTS_LIST}

Si detectas que el texto menciona (aunque sea parcialmente o de forma indirecta) alguna de estas cuentas, devuelve su "id" EXACTO en el campo "cuenta_detectada_id". Si no hay ninguna mención clara o no hay coincidencia razonable, devuelve null.

TEXTO A PROCESAR:
"""
{RAW_TEXT}
"""

Devuelve un objeto con la forma: { "cuenta_detectada_id": "..." | null, "trades": [...] }`

const EXTRACTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    cuenta_detectada_id: { type: 'STRING', nullable: true },
    trades: {
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
    },
  },
  required: ['trades'],
}

async function extractTradesFromText(apiKey: string, rawText: string, accounts: { id: string; name: string }[]): Promise<{ cuenta_detectada_id: string | null; trades: any[] }> {
  const accountsList = accounts.length > 0
    ? accounts.map(a => `- id: "${a.id}", nombre: "${a.name}"`).join('\n')
    : '(el usuario no tiene cuentas creadas todavía)'

  const prompt = EXTRACTION_PROMPT
    .replace('{ACCOUNTS_LIST}', accountsList)
    .replace('{RAW_TEXT}', rawText)

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: EXTRACTION_SCHEMA,
    },
  }
  const raw = await callGeminiWithFallback(apiKey, body)
  const parsed = JSON.parse(raw)
  return {
    cuenta_detectada_id: parsed.cuenta_detectada_id || null,
    trades: parsed.trades || [],
  }
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
  account_id: string
}

function rawToPreview(raw: any, accountId: string): PreviewTrade {
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
    account_id: accountId,
  }
}

/* ==================== TAB: REGISTRAR OPERACIÓN (rediseñada) ==================== */
function RegisterTradeTab() {
  const { addTrade, accounts } = useAppData()
  const [rawText, setRawText] = useState('')
  const [previews, setPreviews] = useState<PreviewTrade[]>([])
  const [detectedAccountId, setDetectedAccountId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [savedCount, setSavedCount] = useState(0)

  const handleInterpret = async () => {
    if (!rawText.trim()) return
    setLoading(true)
    setError('')
    setSaved(false)
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      const { cuenta_detectada_id, trades: rawTrades } = await extractTradesFromText(apiKey, rawText, accounts)
      const validAccountId = accounts.find(a => a.id === cuenta_detectada_id)?.id || ''
      setDetectedAccountId(validAccountId || null)
      const parsed = rawTrades.map(rt => rawToPreview(rt, validAccountId))
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
  const applyAccountToAll = (accountId: string) => {
    setPreviews(prev => prev.map(p => ({ ...p, account_id: accountId })))
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
        account_id: p.account_id || null,
        notes: p.notes,
        created_at: new Date().toISOString(),
      }
      addTrade(trade)
    })
    setSavedCount(previews.length)
    setPreviews([])
    setRawText('')
    setDetectedAccountId(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 4500)
  }

  const detectedAccountName = accounts.find(a => a.id === detectedAccountId)?.name

  return (
    <div className="flex-1 overflow-y-auto space-y-5 pb-4">
      {/* Card de entrada de texto */}
      <Card className="p-6 md:p-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
            <ClipboardList size={19} />
          </div>
          <div>
            <h2 className="serif text-xl font-semibold leading-tight">Registrar operación con Nova</h2>
            <p className="text-xs text-ink-900/50 dark:text-bone-100/50 mt-0.5">Pega los datos tal cual te los da tu broker</p>
          </div>
        </div>

        <div className="mt-6">
          <label className="text-xs font-medium text-ink-900/50 dark:text-bone-100/50 mb-2 flex items-center gap-1.5">
            <Sparkles size={12} className="text-accent" />
            Tip: menciona la cuenta para que Nova la detecte automáticamente
          </label>
          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            rows={7}
            placeholder={`Ej: Esto es de mi cuenta funded de forex.\n\nPega aquí la tabla de tu broker (Acción, Puesto, Volumen, Símbolo, Fechas, Beneficio, Comisión, Intercambio, Precios, SL, TP...)`}
            className="w-full bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3.5 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-accent/30 transition"
          />
        </div>

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <button
            onClick={handleInterpret}
            disabled={loading || !rawText.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light disabled:opacity-50 transition"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Interpretando...
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Interpretar con Nova
              </>
            )}
          </button>

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-loss bg-loss/10 px-3 py-2 rounded-lg">
              <AlertTriangle size={13} /> {error}
            </div>
          )}
        </div>
      </Card>

      {/* Banner de éxito */}
      {saved && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-profit/10 border border-profit/20 text-profit text-sm font-medium">
          <CheckCircle2 size={16} />
          {savedCount} operación(es) guardada(s) correctamente en tu historial.
        </div>
      )}

      {/* Card de previsualización */}
      {previews.length > 0 && (
        <Card className="p-6 md:p-8">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
            <div>
              <h3 className="text-sm font-semibold text-ink-900 dark:text-bone-100">
                {previews.length} operación(es) detectada(s)
              </h3>
              <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mt-0.5">Revisa los datos antes de confirmar</p>
            </div>

            <div className="flex items-center gap-2 bg-accent/5 border border-accent/20 rounded-full pl-3 pr-1.5 py-1.5">
              <Sparkles size={13} className="text-accent flex-shrink-0" />
              <label className="text-xs text-ink-900/60 dark:text-bone-100/60 whitespace-nowrap">Cuenta para todas:</label>
              <select
                value={detectedAccountId || ''}
                onChange={e => { setDetectedAccountId(e.target.value || null); applyAccountToAll(e.target.value) }}
                className="bg-white dark:bg-ink-800 text-xs font-semibold text-accent focus:outline-none rounded-full px-2 py-1"
              >
                <option value="">Sin cuenta</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          {detectedAccountName && (
            <div className="flex items-center gap-1.5 text-xs text-accent bg-accent/5 border border-accent/10 rounded-lg px-3 py-2 mb-5 w-fit">
              <Sparkles size={12} />
              Nova detectó automáticamente: <strong>{detectedAccountName}</strong>
            </div>
          )}

          <div className="space-y-3">
            {previews.map(p => (
              <div key={p.tempId} className="border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden">
                {/* Header de la tarjeta */}
                <div className="flex items-center justify-between px-4 py-3 bg-bone-50 dark:bg-ink-700 border-b border-black/5 dark:border-white/5">
                  <div className="flex items-center gap-2.5">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${p.direction === 'long' ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'}`}>
                      {p.direction === 'long' ? 'LONG' : 'SHORT'}
                    </span>
                    <span className="font-semibold text-sm">{p.symbol || '—'}</span>
                    <span className={`text-sm font-bold ${p.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(p.pnl)}</span>
                  </div>
                  <button onClick={() => removePreview(p.tempId)} className="text-ink-900/30 hover:text-loss dark:text-bone-100/30 transition">
                    <X size={16} />
                  </button>
                </div>

                {/* Body con inputs */}
                <div className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">Símbolo</label>
                      <input value={p.symbol} onChange={e => updatePreview(p.tempId, { symbol: e.target.value.toUpperCase() })}
                        className="w-full mt-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">Dirección</label>
                      <div className="flex gap-1 mt-1">
                        <button type="button" onClick={() => updatePreview(p.tempId, { direction: 'long' })}
                          className={`flex-1 text-xs py-1.5 rounded-lg font-semibold transition ${p.direction === 'long' ? 'bg-profit/15 text-profit' : 'bg-black/5 dark:bg-white/5 text-ink-900/40 dark:text-bone-100/40'}`}>LONG</button>
                        <button type="button" onClick={() => updatePreview(p.tempId, { direction: 'short' })}
                          className={`flex-1 text-xs py-1.5 rounded-lg font-semibold transition ${p.direction === 'short' ? 'bg-loss/15 text-loss' : 'bg-black/5 dark:bg-white/5 text-ink-900/40 dark:text-bone-100/40'}`}>SHORT</button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">Volumen</label>
                      <input type="number" step="0.01" value={p.position_size} onChange={e => updatePreview(p.tempId, { position_size: Number(e.target.value) })}
                        className="w-full mt-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">P&L Neto $</label>
                      <input type="number" step="0.01" value={p.pnl} onChange={e => updatePreview(p.tempId, { pnl: Number(e.target.value) })}
                        className={`w-full mt-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-sm font-semibold ${p.pnl >= 0 ? 'text-profit' : 'text-loss'}`} />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">Precio Entrada</label>
                      <input type="number" step="0.00001" value={p.entry_price} onChange={e => updatePreview(p.tempId, { entry_price: Number(e.target.value) })}
                        className="w-full mt-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">Precio Salida</label>
                      <input type="number" step="0.00001" value={p.exit_price} onChange={e => updatePreview(p.tempId, { exit_price: Number(e.target.value) })}
                        className="w-full mt-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">Stop Loss</label>
                      <input type="number" step="0.00001" value={p.stop_loss ?? ''} onChange={e => updatePreview(p.tempId, { stop_loss: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-full mt-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">Take Profit</label>
                      <input type="number" step="0.00001" value={p.take_profit ?? ''} onChange={e => updatePreview(p.tempId, { take_profit: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-full mt-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-sm" />
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40 flex items-center gap-1">
                      <Wallet size={10} /> Cuenta
                    </label>
                    <select value={p.account_id} onChange={e => updatePreview(p.tempId, { account_id: e.target.value })}
                      className="w-full mt-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-sm">
                      <option value="">Sin cuenta</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>

                  <p className="text-[11px] text-ink-900/40 dark:text-bone-100/40 mt-3 pt-3 border-t border-black/5 dark:border-white/5">
                    {new Date(p.entry_datetime).toLocaleString()} → {new Date(p.exit_datetime).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-5">
            <button
              onClick={handleConfirmAll}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light transition"
            >
              <CheckCircle2 size={16} />
              Confirmar y guardar {previews.length} operación(es)
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}

/* ==================== TAB: CHAT (rediseñado, más compacto) ==================== */
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
    <div className="flex-1 flex gap-3 overflow-hidden">
      {/* Sidebar de conversaciones — más compacta */}
      <div className="w-56 flex-shrink-0 flex flex-col bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-xl overflow-hidden">
        <div className="p-2.5 border-b border-black/10 dark:border-white/10">
          <button
            onClick={startNewConversation}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-light"
          >
            <Plus size={13} /> Nueva conversación
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {conversations.length === 0 && (
            <p className="text-[11px] text-ink-900/30 dark:text-bone-100/30 text-center py-6 px-2">Aún no tienes conversaciones guardadas.</p>
          )}
          {conversations.map(c => (
            <div
              key={c.id}
              onClick={() => openConversation(c)}
              className={`group flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-xs transition ${
                activeConversationId === c.id ? 'bg-accent/10 text-accent' : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <MessageSquare size={12} className="mt-0.5 flex-shrink-0 opacity-50" />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium leading-tight">{c.title}</p>
                <p className="text-[9px] opacity-40 mt-0.5">{new Date(c.updated_at).toLocaleDateString()}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setDeletingId(c.id) }}
                className="opacity-0 group-hover:opacity-100 text-ink-900/30 hover:text-loss dark:text-bone-100/30 flex-shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat principal */}
      <Card className="flex-1 p-0 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-black/5 dark:border-white/5 bg-bone-50/50 dark:bg-ink-700/50">
          <div className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center flex-shrink-0">
            <Bot size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Nova</p>
            <p className="text-[11px] text-ink-900/40 dark:text-bone-100/40 leading-tight">Mentor de trading IA</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.map((m, i) => {
            const isAssistant = m.role === 'assistant'
            return (
              <div key={i} className={`flex items-end gap-2 ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                {isAssistant && (
                  <div className="w-6 h-6 rounded-full bg-accent/15 text-accent flex items-center justify-center flex-shrink-0 mb-0.5">
                    <Bot size={12} />
                  </div>
                )}
                <div
                  className={`max-w-[72%] px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap shadow-sm ${
                    isAssistant
                      ? 'bg-bone-50 dark:bg-ink-700 border border-black/5 dark:border-white/5 rounded-2xl rounded-bl-sm'
                      : 'bg-accent text-white rounded-2xl rounded-br-sm'
                  }`}
                >
                  {m.imagePreview && <img src={m.imagePreview} alt="chart" className="rounded-lg mb-2 max-h-48 w-full object-cover" />}
                  {m.content}
                </div>
                {!isAssistant && (
                  <div className="w-6 h-6 rounded-full bg-black/10 dark:bg-white/10 text-ink-900/60 dark:text-bone-100/60 flex items-center justify-center flex-shrink-0 mb-0.5">
                    <User size={12} />
                  </div>
                )}
              </div>
            )
          })}
          {loading && (
            <div className="flex items-end gap-2 justify-start">
              <div className="w-6 h-6 rounded-full bg-accent/15 text-accent flex items-center justify-center flex-shrink-0">
                <Bot size={12} />
              </div>
              <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-sm bg-bone-50 dark:bg-ink-700 border border-black/5 dark:border-white/5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" />
              </div>
            </div>
          )}
        </div>

        {imagePreview && (
          <div className="px-5">
            <div className="relative w-fit mb-2">
              <img src={imagePreview} className="h-16 rounded-lg border border-black/10 dark:border-white/10" />
              <button onClick={clearImage} className="absolute -top-1.5 -right-1.5 bg-loss text-white rounded-full w-4 h-4 flex items-center justify-center">
                <X size={10} />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 px-5 py-3.5 border-t border-black/5 dark:border-white/5">
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={loading}
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 disabled:opacity-50 hover:bg-black/5 dark:hover:bg-white/5" title="Subir imagen de tu gráfico">
            <ImageIcon size={15} />
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Pregúntame sobre tu trading o sube un gráfico..."
            disabled={loading}
            className="flex-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-full px-4 py-2 text-[13px] disabled:opacity-50"
          />
          <button onClick={send} disabled={loading} className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-accent text-white disabled:opacity-50 hover:bg-accent-light">
            <Send size={15} />
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