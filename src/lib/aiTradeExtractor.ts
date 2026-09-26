// src/lib/aiTradeExtractor.ts
import { compressImage, callGeminiWithFallback } from './gemini'
import type { Direction, InstrumentType } from '../types'

export const INSTRUMENT_OPTIONS: InstrumentType[] = ['Futuros', 'Opciones', 'Forex', 'Acciones', 'Crypto']

const TRADES_PROMPT = `Eres un extractor de datos de operaciones de trading. Puedes recibir una captura de pantalla de un broker/plataforma (MetaTrader, TradingView, NinjaTrader, ThinkorSwim, apps de futuros/forex/cripto...), texto pegado por el usuario describiendo una operación, o una tabla exportada de un broker (tipo MetaTrader) con varias operaciones a la vez.

Extrae SIEMPRE los datos en un array "trades", con un elemento por cada operación distinta que detectes (puede ser 1 sola o varias).

REGLAS GENERALES:
- NO hagas cálculos matemáticos ni interpretes resultados: extrae y normaliza el texto/imagen tal cual, sin inventar nada.
- "direction": usa "long" si es una compra/buy/long, "short" si es una venta/sell/short.
- "instrument_type": infiere uno de estos valores EXACTOS según el símbolo o contexto: "Futuros", "Opciones", "Forex", "Acciones", "Crypto". Si no puedes inferirlo con confianza, usa "Forex".
- Normaliza todos los números: quita símbolos de moneda, espacios y separadores de miles. Usa punto (.) como separador decimal. Conserva el signo negativo si corresponde.
- Las fechas devuélvelas SIEMPRE en formato exacto "YYYY-MM-DDTHH:mm" (24 horas), convirtiéndolas desde cualquier formato original (ejemplo: "08-09-2026 07:31:45" -> "2026-09-08T07:31"). Si no hay fecha visible, devuelve null.
- Si el símbolo tiene una barra "/" (ej: "EUR/USD"), quítala (-> "EURUSD").

RESULTADO ECONÓMICO (sigue el caso que aplique):
- Si en el origen aparece SOLO un resultado final en dinero (profit/loss/P&L total, como en la mayoría de capturas de un solo trade), ponlo en el campo "pnl" y deja "gross_pnl", "commission" y "swap" en null.
- Si en el origen aparecen columnas separadas de "Beneficio", "Comisión" e "Intercambio/Swap" (típico de exportaciones de MetaTrader), NO las sumes tú: coloca cada una en su campo por separado ("gross_pnl" = Beneficio, "commission" = Comisión, "swap" = Intercambio) y deja "pnl" en null.

Si un dato no aparece o no se puede determinar con confianza, devuélvelo como null. NO inventes datos.

DETECCIÓN DE CUENTA:
El usuario puede mencionar de forma natural, en cualquier parte del texto, a qué cuenta pertenecen estas operaciones (ej: "esto es de mi cuenta funded de forex", "cuenta demo FTMO", "operé con la cuenta real").
Estas son las cuentas disponibles del usuario (compara por similitud de nombre, no hace falta coincidencia exacta):
{ACCOUNTS_LIST}
Si detectas que el texto menciona (aunque sea parcialmente o de forma indirecta) alguna de estas cuentas, devuelve su "id" EXACTO en el campo "cuenta_detectada_id". Si no hay ninguna mención clara o no hay coincidencia razonable, devuelve null.

TEXTO ADICIONAL PEGADO POR EL USUARIO (puede estar vacío):
"""
{RAW_TEXT}
"""

Devuelve un único objeto JSON con la forma: { "cuenta_detectada_id": "..." | null, "trades": [ ... ] }`

const TRADE_ITEM_SCHEMA = {
  type: 'OBJECT',
  properties: {
    symbol: { type: 'STRING', nullable: true },
    instrument_type: { type: 'STRING', enum: INSTRUMENT_OPTIONS, nullable: true },
    direction: { type: 'STRING', enum: ['long', 'short'], nullable: true },
    entry_price: { type: 'NUMBER', nullable: true },
    exit_price: { type: 'NUMBER', nullable: true },
    position_size: { type: 'NUMBER', nullable: true },
    pnl: { type: 'NUMBER', nullable: true },
    gross_pnl: { type: 'NUMBER', nullable: true },
    commission: { type: 'NUMBER', nullable: true },
    swap: { type: 'NUMBER', nullable: true },
    stop_loss: { type: 'NUMBER', nullable: true },
    take_profit: { type: 'NUMBER', nullable: true },
    entry_datetime: { type: 'STRING', nullable: true },
    exit_datetime: { type: 'STRING', nullable: true },
    position_id: { type: 'STRING', nullable: true },
  },
}

const TRADES_SCHEMA = {
  type: 'OBJECT',
  properties: {
    cuenta_detectada_id: { type: 'STRING', nullable: true },
    trades: { type: 'ARRAY', items: TRADE_ITEM_SCHEMA },
  },
  required: ['trades'],
}

// Recorta a lo que <input type="datetime-local"> acepta, por si Gemini devuelve segundos u otro formato
function toDatetimeLocalValue(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const match = raw.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/)
  return match ? match[1] : undefined
}

export function nowDatetimeLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export interface ExtractedTradeData {
  symbol?: string
  instrument_type?: InstrumentType
  direction?: Direction
  entry_price?: number
  exit_price?: number
  position_size?: number
  pnl?: number
  stop_loss?: number
  take_profit?: number
  entry_datetime?: string
  exit_datetime?: string
  notes?: string
}

export interface ExtractTradesResult {
  accountId: string | null
  trades: ExtractedTradeData[]
}

function consolidateTrade(t: any): ExtractedTradeData | null {
  const mapped: ExtractedTradeData = {}
  if (t.symbol) mapped.symbol = String(t.symbol).toUpperCase().replace(/\//g, '')
  if (t.instrument_type && INSTRUMENT_OPTIONS.includes(t.instrument_type)) mapped.instrument_type = t.instrument_type
  if (t.direction === 'long' || t.direction === 'short') mapped.direction = t.direction
  if (t.entry_price != null) mapped.entry_price = Number(t.entry_price)
  if (t.exit_price != null) mapped.exit_price = Number(t.exit_price)
  if (t.position_size != null) mapped.position_size = Number(t.position_size)
  if (t.stop_loss != null) mapped.stop_loss = Number(t.stop_loss)
  if (t.take_profit != null) mapped.take_profit = Number(t.take_profit)

  const entryDt = toDatetimeLocalValue(t.entry_datetime)
  const exitDt = toDatetimeLocalValue(t.exit_datetime)
  if (entryDt) mapped.entry_datetime = entryDt
  if (exitDt) mapped.exit_datetime = exitDt

  if (t.pnl != null) {
    mapped.pnl = Number(t.pnl)
  } else if (t.gross_pnl != null) {
    const gross = Number(t.gross_pnl)
    const commission = t.commission != null ? Number(t.commission) : 0
    const swap = t.swap != null ? Number(t.swap) : 0
    mapped.pnl = Number((gross + commission + swap).toFixed(2))

    const notesParts: string[] = []
    if (t.position_id) notesParts.push(`ID posición: ${t.position_id}`)
    notesParts.push(`Beneficio bruto: $${gross.toFixed(2)}`)
    if (commission) notesParts.push(`Comisión: $${commission.toFixed(2)}`)
    if (swap) notesParts.push(`Swap: $${swap.toFixed(2)}`)
    notesParts.push('Registrado vía Nova IA')
    mapped.notes = notesParts.join(' · ')
  }

  return Object.keys(mapped).length > 0 ? mapped : null
}

export async function extractTrades(
  apiKey: string,
  files: File[],
  pastedText: string,
  accounts: { id: string; name: string }[] = []
): Promise<ExtractTradesResult> {
  const accountsList = accounts.length > 0
    ? accounts.map(a => `- id: "${a.id}", nombre: "${a.name}"`).join('\n')
    : '(el usuario no tiene cuentas creadas todavía)'

  const prompt = TRADES_PROMPT
    .replace('{ACCOUNTS_LIST}', accountsList)
    .replace('{RAW_TEXT}', pastedText.trim() || '(sin texto adicional)')

  const parts: any[] = [{ text: prompt }]
  for (const file of files) {
    const { base64, mimeType } = await compressImage(file)
    parts.push({ inlineData: { mimeType, data: base64 } })
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: TRADES_SCHEMA,
    },
  }

  const raw = await callGeminiWithFallback(apiKey, body)
  const parsed = JSON.parse(raw)

  const rawTrades: any[] = Array.isArray(parsed.trades) ? parsed.trades : []
  const trades = rawTrades
    .map(consolidateTrade)
    .filter((t): t is ExtractedTradeData => t !== null)

  if (trades.length === 0) {
    throw new Error('Nova no pudo extraer datos claros. Prueba con otra captura, texto más completo, o revisa el formato.')
  }

  const accountId = parsed.cuenta_detectada_id && accounts.some(a => a.id === parsed.cuenta_detectada_id)
    ? parsed.cuenta_detectada_id
    : null

  return { accountId, trades }
}