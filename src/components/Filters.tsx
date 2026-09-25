import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, Layers, Repeat, Boxes, LineChart, Coins, ListChecks } from 'lucide-react'
import type { InstrumentType, AccountPhase } from '../types'

const INSTRUMENT_ICONS: Record<string, any> = {
  Forex: Repeat,
  Futuros: Boxes,
  Acciones: LineChart,
  Crypto: Coins,
  Opciones: ListChecks,
}

function useClickOutside(ref: React.RefObject<HTMLElement>, onOutside: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, onOutside])
}

/* ==================== DROPDOWN SIMPLE DE INSTRUMENTO ==================== */
export interface InstrumentDropdownOption {
  value: string
  label: string
}

export function InstrumentDropdown({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: InstrumentDropdownOption[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const current = options.find(o => o.value === value)
  const Icon = current ? (INSTRUMENT_ICONS[current.value] || Layers) : Layers

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-ink-800 text-sm font-medium shadow-soft hover:bg-black/5 dark:hover:bg-white/5 transition"
      >
        <Icon size={15} className="text-accent" />
        <span>{current?.label ?? '—'}</span>
        <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 mt-2 right-0 w-56 bg-white dark:bg-ink-800 border border-black/10 dark:border-white/10 rounded-2xl shadow-xl p-2">
          {options.map(o => {
            const OptIcon = INSTRUMENT_ICONS[o.value] || Layers
            const active = value === o.value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition ${
                  active
                    ? 'bg-accent/10 text-accent'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 text-ink-900/70 dark:text-bone-100/70'
                }`}
              >
                <OptIcon size={15} />
                {o.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ==================== DROPDOWN DE DOS NIVELES: INSTRUMENTO + FASE ==================== */
export interface AccountGroupValue {
  instrument: InstrumentType | 'Todas'
  phase: AccountPhase | 'Capital Real' | 'Todas'
}

const CAN_BE_PROP_FIRM = (t: InstrumentType) => t === 'Forex' || t === 'Futuros'
const PHASE_OPTIONS = (t: InstrumentType): AccountPhase[] =>
  t === 'Forex' ? ['Fase 1', 'Fase 2', 'Funded'] : t === 'Futuros' ? ['Challenge', 'Funded'] : []

const INSTRUMENTS: InstrumentType[] = ['Forex', 'Futuros', 'Acciones', 'Crypto', 'Opciones']

export function AccountGroupDropdown({
  value,
  onChange,
}: {
  value: AccountGroupValue
  onChange: (v: AccountGroupValue) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const label =
    value.instrument === 'Todas'
      ? 'Todas las cuentas'
      : CAN_BE_PROP_FIRM(value.instrument) && value.phase !== 'Todas'
        ? `${value.instrument} · ${value.phase}`
        : value.instrument

  const Icon = value.instrument !== 'Todas' ? (INSTRUMENT_ICONS[value.instrument] || Layers) : Layers

  const selectInstrument = (instrument: InstrumentType | 'Todas') => {
    onChange({ instrument, phase: 'Todas' })
  }
  const selectPhase = (phase: AccountPhase | 'Capital Real' | 'Todas') => {
    onChange({ ...value, phase })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-ink-800 text-sm font-medium shadow-soft hover:bg-black/5 dark:hover:bg-white/5 transition"
      >
        <Icon size={15} className="text-accent" />
        <span>{label}</span>
        <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 mt-2 right-0 w-72 bg-white dark:bg-ink-800 border border-black/10 dark:border-white/10 rounded-2xl shadow-xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-2">Instrumento</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => selectInstrument('Todas')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                value.instrument === 'Todas'
                  ? 'bg-accent/10 border-accent/30 text-accent'
                  : 'border-black/10 dark:border-white/10 text-ink-900/60 dark:text-bone-100/60 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              Todas
            </button>
            {INSTRUMENTS.map(inst => {
              const InstIcon = INSTRUMENT_ICONS[inst] || Layers
              const active = value.instrument === inst
              return (
                <button
                  key={inst}
                  type="button"
                  onClick={() => selectInstrument(inst)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    active
                      ? 'bg-accent/10 border-accent/30 text-accent'
                      : 'border-black/10 dark:border-white/10 text-ink-900/60 dark:text-bone-100/60 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <InstIcon size={12} /> {inst}
                </button>
              )
            })}
          </div>

          {value.instrument !== 'Todas' && CAN_BE_PROP_FIRM(value.instrument) && (
            <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-2">Fase</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => selectPhase('Todas')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    value.phase === 'Todas'
                      ? 'bg-accent/10 border-accent/30 text-accent'
                      : 'border-black/10 dark:border-white/10 text-ink-900/60 dark:text-bone-100/60 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  Todas
                </button>
                {PHASE_OPTIONS(value.instrument).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => selectPhase(p)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      value.phase === p
                        ? 'bg-accent/10 border-accent/30 text-accent'
                        : 'border-black/10 dark:border-white/10 text-ink-900/60 dark:text-bone-100/60 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {value.instrument !== 'Todas' && !CAN_BE_PROP_FIRM(value.instrument) && (
            <p className="mt-3 text-[11px] text-ink-900/40 dark:text-bone-100/40">
              {value.instrument} siempre se gestiona como Capital Real.
            </p>
          )}
        </div>
      )}
    </div>
  )
}