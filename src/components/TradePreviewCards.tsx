// src/components/TradePreviewCards.tsx
import { X, Sparkles, CheckCircle2, Wallet } from 'lucide-react'
import { fmt } from '../utils'
import { Card } from './ui'
import { nowDatetimeLocal } from '../lib/aiTradeExtractor'
import type { ExtractedTradeData } from '../lib/aiTradeExtractor'
import type { Direction, InstrumentType } from '../types'

const INSTRUMENT_OPTIONS: InstrumentType[] = ['Futuros', 'Opciones', 'Forex', 'Acciones', 'Crypto']

export interface PreviewTrade {
  tempId: string
  symbol: string
  instrument_type: InstrumentType
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

export function buildPreviewTrade(t: ExtractedTradeData, accountId: string): PreviewTrade {
  return {
    tempId: crypto.randomUUID(),
    symbol: t.symbol || '',
    instrument_type: t.instrument_type || 'Forex',
    direction: t.direction || 'long',
    entry_price: t.entry_price ?? 0,
    exit_price: t.exit_price ?? 0,
    position_size: t.position_size ?? 0,
    pnl: t.pnl ?? 0,
    stop_loss: t.stop_loss,
    take_profit: t.take_profit,
    entry_datetime: t.entry_datetime || nowDatetimeLocal(),
    exit_datetime: t.exit_datetime || nowDatetimeLocal(),
    notes: t.notes || '',
    account_id: accountId,
  }
}

interface Props {
  previews: PreviewTrade[]
  accounts: { id: string; name: string }[]
  detectedAccountId: string | null
  detectedAccountName?: string
  onUpdate: (tempId: string, patch: Partial<PreviewTrade>) => void
  onRemove: (tempId: string) => void
  onAccountChangeAll: (accountId: string) => void
  onConfirm: () => void
  confirmLabel?: string
}

export function TradePreviewCards({
  previews, accounts, detectedAccountId, detectedAccountName,
  onUpdate, onRemove, onAccountChangeAll, onConfirm, confirmLabel,
}: Props) {
  return (
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
            onChange={e => onAccountChangeAll(e.target.value)}
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
            <div className="flex items-center justify-between px-4 py-3 bg-bone-50 dark:bg-ink-700 border-b border-black/5 dark:border-white/5">
              <div className="flex items-center gap-2.5">
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${p.direction === 'long' ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'}`}>
                  {p.direction === 'long' ? 'LONG' : 'SHORT'}
                </span>
                <span className="font-semibold text-sm">{p.symbol || '—'}</span>
                <span className={`text-sm font-bold ${p.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(p.pnl)}</span>
              </div>
              <button onClick={() => onRemove(p.tempId)} className="text-ink-900/30 hover:text-loss dark:text-bone-100/30 transition">
                <X size={16} />
              </button>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">Símbolo</label>
                  <input value={p.symbol} onChange={e => onUpdate(p.tempId, { symbol: e.target.value.toUpperCase() })}
                    className="w-full mt-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">Instrumento</label>
                  <select value={p.instrument_type} onChange={e => onUpdate(p.tempId, { instrument_type: e.target.value as InstrumentType })}
                    className="w-full mt-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-sm">
                    {INSTRUMENT_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">Dirección</label>
                  <div className="flex gap-1 mt-1">
                    <button type="button" onClick={() => onUpdate(p.tempId, { direction: 'long' })}
                      className={`flex-1 text-xs py-1.5 rounded-lg font-semibold transition ${p.direction === 'long' ? 'bg-profit/15 text-profit' : 'bg-black/5 dark:bg-white/5 text-ink-900/40 dark:text-bone-100/40'}`}>LONG</button>
                    <button type="button" onClick={() => onUpdate(p.tempId, { direction: 'short' })}
                      className={`flex-1 text-xs py-1.5 rounded-lg font-semibold transition ${p.direction === 'short' ? 'bg-loss/15 text-loss' : 'bg-black/5 dark:bg-white/5 text-ink-900/40 dark:text-bone-100/40'}`}>SHORT</button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">Volumen</label>
                  <input type="number" step="0.01" value={p.position_size} onChange={e => onUpdate(p.tempId, { position_size: Number(e.target.value) })}
                    className="w-full mt-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">P&L Neto $</label>
                  <input type="number" step="0.01" value={p.pnl} onChange={e => onUpdate(p.tempId, { pnl: Number(e.target.value) })}
                    className={`w-full mt-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-sm font-semibold ${p.pnl >= 0 ? 'text-profit' : 'text-loss'}`} />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">Precio Entrada</label>
                  <input type="number" step="0.00001" value={p.entry_price} onChange={e => onUpdate(p.tempId, { entry_price: Number(e.target.value) })}
                    className="w-full mt-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">Precio Salida</label>
                  <input type="number" step="0.00001" value={p.exit_price} onChange={e => onUpdate(p.tempId, { exit_price: Number(e.target.value) })}
                    className="w-full mt-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">Stop Loss</label>
                  <input type="number" step="0.00001" value={p.stop_loss ?? ''} onChange={e => onUpdate(p.tempId, { stop_loss: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full mt-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">Take Profit</label>
                  <input type="number" step="0.00001" value={p.take_profit ?? ''} onChange={e => onUpdate(p.tempId, { take_profit: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full mt-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-sm" />
                </div>
              </div>

              <div className="mt-3">
                <label className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40 flex items-center gap-1">
                  <Wallet size={10} /> Cuenta
                </label>
                <select value={p.account_id} onChange={e => onUpdate(p.tempId, { account_id: e.target.value })}
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
          onClick={onConfirm}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light transition"
        >
          <CheckCircle2 size={16} />
          {confirmLabel || `Confirmar y guardar ${previews.length} operación(es)`}
        </button>
      </div>
    </Card>
  )
}