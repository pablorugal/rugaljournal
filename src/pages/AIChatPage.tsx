import { useState, useRef } from 'react'
import {
  Bot, Send, Image as ImageIcon, X, Plus, Trash2, MessageSquare, AlertTriangle, ClipboardList,
  User, Sparkles, CheckCircle2,
} from 'lucide-react'
import { useAppData } from '../contexts'
import { computeMetrics } from '../calculations'
import { fmt } from '../utils'
import { Card, SectionHeader, PillTabs, Modal } from '../components/ui'
import { TradePreviewCards, buildPreviewTrade, type PreviewTrade } from '../components/TradePreviewCards'
import { extractTrades } from '../lib/aiTradeExtractor'
import { compressImage, callGeminiWithFallback } from '../lib/gemini'
import type { Trade, ChatMessage, Conversation } from '../types'

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

/* ==================== TAB: REGISTRAR OPERACIÓN ==================== */
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
      const { accountId, trades } = await extractTrades(apiKey, [], rawText, accounts)
      setDetectedAccountId(accountId)
      setPreviews(trades.map(t => buildPreviewTrade(t, accountId || '')))
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
    setDetectedAccountId(accountId || null)
    setPreviews(prev => prev.map(p => ({ ...p, account_id: accountId })))
  }

  const handleConfirmAll = () => {
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

      {saved && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-profit/10 border border-profit/20 text-profit text-sm font-medium">
          <CheckCircle2 size={16} />
          {savedCount} operación(es) guardada(s) correctamente en tu historial.
        </div>
      )}

      {previews.length > 0 && (
        <TradePreviewCards
          previews={previews}
          accounts={accounts}
          detectedAccountId={detectedAccountId}
          detectedAccountName={detectedAccountName}
          onUpdate={updatePreview}
          onRemove={removePreview}
          onAccountChangeAll={applyAccountToAll}
          onConfirm={handleConfirmAll}
        />
      )}
    </div>
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
    <div className="flex-1 flex gap-3 overflow-hidden">
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