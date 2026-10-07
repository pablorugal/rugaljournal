import React, { useState } from 'react'
import { UploadCloud, X } from 'lucide-react'
import type { Direction } from '../types'
import { InfoTooltip } from './InfoTooltip'

export function Card({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return <div onClick={onClick} className={`tj-card bg-white dark:bg-ink-800 border border-black/5 dark:border-ink-600 rounded-2xl shadow-soft ${className}`}>{children}</div>
}
export function SectionHeader({ eyebrow, title, subtitle, right }: { eyebrow: string; title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
      <div>
        <p className="font-mono text-[11px] font-medium tracking-[0.18em] uppercase text-accent mb-2">{eyebrow}</p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-ink-900/60 dark:text-bone-100/60 mt-1.5">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-3">{right}</div>}
    </div>
  )
}
export function StatCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean | null }) {
  const color = positive === undefined || positive === null ? 'text-ink-900 dark:text-bone-100' : positive ? 'text-profit' : 'text-loss'
  return (
    <Card className="p-5">
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-900/50 dark:text-bone-100/50 mb-2.5">{label}</p>
      <p className={`text-2xl font-extrabold tracking-tight tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mt-1">{sub}</p>}
    </Card>
  )
}
export function PillTabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="inline-flex bg-black/5 dark:bg-ink-800 dark:border dark:border-ink-600 p-1 rounded-full gap-1 flex-wrap">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${active === t.id ? 'bg-white dark:bg-accent/15 shadow-soft text-ink-900 dark:text-accent font-semibold' : 'text-ink-900/60 dark:text-bone-100/60 hover:text-ink-900 dark:hover:text-bone-100'}`}>
          {t.label}
        </button>
      ))}
    </div>
  )
}
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button type="button" onClick={() => onChange(!checked)} className={`w-11 h-6 rounded-full relative transition ${checked ? 'bg-accent' : 'bg-black/15 dark:bg-white/15'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  )
}
export function DirectionToggle({ value, onChange }: { value: Direction; onChange: (v: Direction) => void }) {
  return (
    <div className="inline-flex rounded-xl overflow-hidden border border-black/10 dark:border-ink-600">
      <button type="button" onClick={() => onChange('long')} className={`px-5 py-2 text-sm font-semibold transition ${value === 'long' ? 'bg-profit text-white dark:text-ink-900' : 'bg-transparent text-ink-900/50 dark:text-bone-100/50'}`}>LONG</button>
      <button type="button" onClick={() => onChange('short')} className={`px-5 py-2 text-sm font-semibold transition ${value === 'short' ? 'bg-loss text-white dark:text-ink-900' : 'bg-transparent text-ink-900/50 dark:text-bone-100/50'}`}>SHORT</button>
    </div>
  )
}
export function Gauge({ score, size = 'md' }: { score: number; size?: 'md' | 'lg' }) {
  const clamped = Math.max(0, Math.min(100, score))
  const radius = 80
  const circumference = Math.PI * radius
  const offset = circumference * (1 - clamped / 100)
  const color = clamped >= 70 ? 'rgb(var(--c-profit))' : clamped >= 40 ? 'rgb(var(--c-accent))' : 'rgb(var(--c-loss))'
  const dims = size === 'lg'
    ? { w: 240, h: 132, numberClass: 'text-5xl', topClass: 'top-9' }
    : { w: 200, h: 110, numberClass: 'text-4xl', topClass: 'top-8' }
  return (
    <div className="relative flex flex-col items-center">
      <svg width={dims.w} height={dims.h} viewBox="0 0 200 110">
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="currentColor" className="text-black/10 dark:text-ink-600" strokeWidth="14" strokeLinecap="round" />
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" style={{ stroke: color, transition: 'stroke-dashoffset 0.6s ease' }} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className={`absolute ${dims.topClass} flex flex-col items-center`}>
        <span className={`serif ${dims.numberClass} font-extrabold`}>{clamped}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-900/40 dark:text-bone-100/40">Score</span>
      </div>
    </div>
  )
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-ink-900/60 dark:text-bone-100/60 mb-1.5">{label}</label>{children}</div>
}
export const inputCls = 'w-full bg-bone-50 dark:bg-ink-900 border border-black/10 dark:border-ink-600 rounded-xl px-3 py-2 text-sm placeholder:text-ink-900/30 dark:placeholder:text-bone-100/30 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60'

export function Modal({ open, onClose, children, widthClass = 'max-w-lg' }: { open: boolean; onClose: () => void; children: React.ReactNode; widthClass?: string }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white dark:bg-ink-800 dark:border dark:border-ink-600 rounded-2xl shadow-xl w-full ${widthClass} max-h-[90vh] overflow-y-auto p-6 md:p-8`}>
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  )
}

export function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-4 py-1.5 rounded-full border text-sm font-medium transition ${
        active
          ? 'bg-black/5 dark:bg-accent/15 border-black/20 dark:border-accent/40 text-ink-900 dark:text-accent font-semibold'
          : 'border-black/10 dark:border-ink-600 text-ink-900/50 dark:text-bone-100/50 hover:bg-black/5 dark:hover:bg-white/5'
      }`}>
      {children}
    </button>
  )
}
export function ScreenshotUploader({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const [dragOver, setDragOver] = useState(false)
  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return
    const valid = Array.from(fileList).filter(f => f.size <= 5 * 1024 * 1024 && /image\/(png|jpe?g)/.test(f.type))
    onChange([...files, ...valid])
  }
  return (
    <div onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
      className={`border-2 border-dashed rounded-xl p-5 text-center transition ${dragOver ? 'border-accent/60 bg-accent/5' : 'border-black/10 dark:border-ink-600'}`}>
      <UploadCloud className="mx-auto mb-2 text-ink-900/30 dark:text-bone-100/30" size={20} />
      <p className="text-xs text-ink-900/50 dark:text-bone-100/50">Arrastra capturas aquí o</p>
      <label className="text-accent text-xs font-medium cursor-pointer hover:underline">
        selecciona archivos
        <input type="file" accept="image/png,image/jpeg" multiple hidden onChange={e => handleFiles(e.target.files)} />
      </label>
      {files.length > 0 && <p className="text-[11px] mt-2 text-ink-900/50 dark:text-bone-100/50">{files.length} imagen(es) seleccionada(s)</p>}
    </div>
  )
}

export function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-5 rounded-2xl border border-black/10 dark:border-ink-600 bg-white dark:bg-ink-800">
      <span className="text-sm font-medium">{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}
export function RadioRow({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect}
      className="w-full flex items-center gap-3 p-5 rounded-2xl border border-black/10 dark:border-ink-600 bg-white dark:bg-ink-800 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition">
      <span className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition ${selected ? 'border-accent' : 'border-black/20 dark:border-white/20'}`}>
        {selected && <span className="w-2.5 h-2.5 rounded-full bg-accent" />}
      </span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}
export function EmotionSliderStyled({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const pct = ((value - 1) / 9) * 100
  const zone = value <= 4 ? 'risk' : value <= 6 ? 'caution' : 'optimal'
  const zoneLabel = zone === 'optimal' ? 'Condiciones óptimas' : zone === 'caution' ? 'Operable con precaución' : 'Alto riesgo'
  const zoneColor = zone === 'optimal' ? 'text-profit' : zone === 'caution' ? 'text-ink-900/60 dark:text-bone-100/60' : 'text-loss'
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-lg font-medium">Estado emocional ({value}/10)</p>
        <p className={`text-sm font-semibold ${zoneColor}`}>{zoneLabel}</p>
      </div>
      <div className="relative h-2 rounded-full bg-black/10 dark:bg-white/10 mb-3">
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent pointer-events-none" style={{ width: `${pct}%` }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 border-accent shadow pointer-events-none" style={{ left: `calc(${pct}% - 10px)` }} />
        <input type="range" min={1} max={10} value={value} onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      </div>
      <div className="flex justify-between text-xs text-ink-900/40 dark:text-bone-100/40">
        <span>1-4 Alto riesgo</span><span>5-6 Precaución</span><span>7-10 Óptimo</span>
      </div>
    </div>
  )
}

export function Block({ icon: Icon, title, children, first = false }: { icon: any; title: string; children: React.ReactNode; first?: boolean }) {
  return (
    <div className={first ? '' : 'border-t border-black/10 dark:border-ink-600 pt-8'}>
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} className="text-accent" />
        <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-ink-900/50 dark:text-bone-100/50">{title}</h3>
      </div>
      {children}
    </div>
  )
}
export function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black/5 dark:bg-ink-700 rounded-lg px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-900/40 dark:text-bone-100/40">{label}</p>
      <p className="font-semibold text-sm">{value}</p>
    </div>
  )
}

/* ==================== K2 — TABLAS RANKEADAS (Best/Worst hora-día, Sesión, Símbolos) ==================== */
export interface BarRowItem {
  key: string
  label: string
  value: number
  count: number
  winRate: number
  expectancy: number
}

export function BarRow({ item, maxAbs }: { item: BarRowItem; maxAbs: number }) {
  const positive = item.value >= 0
  const widthPct = maxAbs > 0 ? Math.min((Math.abs(item.value) / maxAbs) * 100, 100) : 0
  return (
    <div className="flex items-center gap-4 py-2">
      <span className="w-28 shrink-0 text-xs font-medium text-ink-900/70 dark:text-bone-100/70 truncate">{item.label}</span>
      <div className="flex-1 h-5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${positive ? 'bg-profit' : 'bg-loss'}`}
          style={{ width: `${widthPct}%`, minWidth: widthPct > 0 ? 4 : 0 }}
        />
      </div>
      <span className={`w-20 shrink-0 text-right text-xs font-semibold tabular-nums ${positive ? 'text-profit' : 'text-loss'}`}>
        {positive ? '+' : ''}{item.value.toFixed(2)}
      </span>
      <span className="w-16 shrink-0 text-right text-[11px] text-ink-900/40 dark:text-bone-100/40 tabular-nums">{item.count} trades</span>
      <span className="w-14 shrink-0 text-right text-[11px] text-ink-900/40 dark:text-bone-100/40 tabular-nums">{item.winRate}%</span>
      <span className="w-20 shrink-0 text-right text-[11px] text-ink-900/40 dark:text-bone-100/40 tabular-nums">Exp {item.expectancy.toFixed(2)}</span>
    </div>
  )
}

export function RankedTableCard({ title, items, right, info, scrollHeight }: { title: string; items: BarRowItem[]; right?: React.ReactNode; info?: string; scrollHeight?: number }) {
  const maxAbs = Math.max(1, ...items.map(i => Math.abs(i.value)))
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="serif text-xl font-semibold flex items-center">{title}{info && <InfoTooltip text={info} />}</h3>
        {right}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no hay datos suficientes.</p>
      ) : (
        <div
          className="divide-y divide-black/5 dark:divide-white/5 overflow-y-auto pr-1"
          style={scrollHeight ? { height: `${scrollHeight}px` } : undefined}
        >
          {items.map(item => <BarRow key={item.key} item={item} maxAbs={maxAbs} />)}
        </div>
      )}
    </Card>
  )
}

/* ==================== K2 — HEATMAP DÍA × HORA ==================== */
export interface HeatmapCellData {
  day: number
  hour: number
  pnl: number
  count: number
  winRate: number
}

const HEATMAP_DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function HeatmapGrid({ cells }: { cells: HeatmapCellData[] }) {
  const maxAbs = Math.max(1, ...cells.map(c => Math.abs(c.pnl)))
  const byKey = new Map(cells.map(c => [`${c.day}-${c.hour}`, c]))
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-[3px]" style={{ gridTemplateColumns: `32px repeat(24, 1fr)` }}>
        <div />
        {Array.from({ length: 24 }).map((_, h) => (
          <div key={h} className="text-[9px] text-center text-ink-900/30 dark:text-bone-100/30">{h}</div>
        ))}
        {HEATMAP_DAY_LABELS.map((label, day) => (
          <React.Fragment key={day}>
            <div className="text-[10px] text-ink-900/50 dark:text-bone-100/50 flex items-center">{label}</div>
            {Array.from({ length: 24 }).map((_, hour) => {
              const cell = byKey.get(`${day}-${hour}`)
              const pnl = cell?.pnl ?? 0
              const count = cell?.count ?? 0
              const opacity = count > 0 ? Math.max(0.15, Math.min(1, Math.abs(pnl) / maxAbs)) : 1
              const positive = pnl >= 0
              return (
                <div
                  key={hour}
                  title={count > 0 ? `${label} ${hour}:00 · ${count} trades · ${pnl.toFixed(2)} · WR ${cell?.winRate}%` : `${label} ${hour}:00 · sin datos`}
                  className={`w-5 h-5 rounded-[3px] ${count > 0 ? (positive ? 'bg-profit' : 'bg-loss') : 'bg-black/5 dark:bg-white/5'}`}
                  style={{ opacity }}
                />
              )
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

/* ==================== K2 — TABLA MATRIZ (Símbolo × Sesión) ==================== */
export interface MatrixCellData {
  rowKey: string
  colKey: string
  pnl: number
  count: number
  winRate: number
}

export function MatrixTable({ rows, cols, cells, rowLabel = 'Símbolo' }: { rows: string[]; cols: string[]; cells: MatrixCellData[]; rowLabel?: string }) {
  const byKey = new Map(cells.map(c => [`${c.rowKey}__${c.colKey}`, c]))
  if (rows.length === 0) {
    return <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no hay datos suficientes.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-ink-900/40 dark:text-bone-100/40 border-b border-black/5 dark:border-white/5">
            <th className="py-2 pr-4">{rowLabel}</th>
            {cols.map(c => <th key={c} className="py-2 px-3 text-right">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row} className="border-b border-black/5 dark:border-white/5 last:border-0">
              <td className="py-2 pr-4 font-medium">{row}</td>
              {cols.map(col => {
                const cell = byKey.get(`${row}__${col}`)
                if (!cell || cell.count === 0) {
                  return <td key={col} className="py-2 px-3 text-right text-ink-900/20 dark:text-bone-100/20">—</td>
                }
                const positive = cell.pnl >= 0
                return (
                  <td key={col} className={`py-2 px-3 text-right rounded-lg ${positive ? 'bg-profit/10' : 'bg-loss/10'}`}>
                    <span className={`font-semibold tabular-nums ${positive ? 'text-profit' : 'text-loss'}`}>{cell.pnl.toFixed(0)}</span>
                    <span className="block text-[10px] text-ink-900/40 dark:text-bone-100/40">{cell.count}tr · {cell.winRate}%</span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ==================== K2 — STATUS PILL (Session Clock) ==================== */
export function StatusPill({ live }: { live: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
      live ? 'bg-profit/15 text-profit' : 'bg-black/5 text-ink-900/40 dark:bg-white/5 dark:text-bone-100/40'
    }`}>
      {live ? 'Live' : 'Cerrado'}
    </span>
  )
}
