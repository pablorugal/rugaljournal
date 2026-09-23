import { useState } from 'react'
import { Bot, Send } from 'lucide-react'
import { useAppData } from '../contexts'
import { computeMetrics } from '../calculations'
import { fmt } from '../utils'
import { Card, SectionHeader } from '../components/ui'

export default function AIChatPage() {
  const { trades, settings } = useAppData()
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '¡Hola! Soy tu mentor de trading. Puedo analizar tus operaciones, identificar patrones en tu comportamiento y darte consejos personalizados basados en tus datos reales. ¿Qué quieres revisar hoy?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const send = async () => {
    if (!input.trim() || loading) return
    const userMessage = input
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setInput('')
    setLoading(true)

    try {
      const metrics = computeMetrics(trades, settings)
      const resumenTrades = trades.slice(0, 20).map(t => ({
        symbol: t.symbol,
        direction: t.direction,
        pnl: t.pnl,
        fecha: t.exit_datetime,
        setup: t.custom_setup,
        notas: t.notes,
      }))

      const contexto = `
        Eres un mentor de trading experto y directo. Analiza los datos reales de este trader.

        RESUMEN GENERAL:
        - Total de trades: ${trades.length}
        - Net P&L: ${fmt(metrics.netPnl)}
        - Win Rate: ${metrics.winRate}%
        - Profit Factor: ${metrics.profitFactor}

        ÚLTIMOS TRADES (máx 20):
        ${JSON.stringify(resumenTrades, null, 2)}

        PREGUNTA DEL TRADER: ${userMessage}

        Responde en español, de forma concreta, específica y basada en los datos reales de arriba.
        Si detectas patrones (ej: pérdidas repetidas en un símbolo, malas rachas, etc), menciónalos.
      `

      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: contexto }] }],
          }),
        }
      )

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error.message || 'Error de la API')
      }

      const respuesta = data.candidates?.[0]?.content?.parts?.[0]?.text
        || 'No pude generar una respuesta. Intenta de nuevo.'

      setMessages(prev => [...prev, { role: 'assistant', content: respuesta }])
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Error al conectar con la IA: ${err.message || 'inténtalo de nuevo.'}`
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <SectionHeader
        eyebrow="Herramientas"
        title="Nova IA"
        subtitle="Tu mentor de trading personal impulsado por IA."
        right={<Bot className="text-accent" size={28} />}
      />
      <Card className="flex-1 p-6 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-lg p-3 rounded-xl text-sm whitespace-pre-wrap ${
                m.role === 'assistant' ? 'bg-accent/10' : 'bg-black/5 dark:bg-white/5 ml-auto'
              }`}
            >
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="max-w-lg p-3 rounded-xl text-sm bg-accent/10 animate-pulse">
              Pensando...
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Pregúntame sobre tu trading..."
            disabled={loading}
            className="flex-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={loading}
            className="px-4 rounded-lg bg-accent text-white disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      </Card>
    </div>
  )
}