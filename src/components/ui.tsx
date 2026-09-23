import React, { useState } from 'react'
import { UploadCloud, X, Check } from 'lucide-react'
import type { Direction } from '../types'

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white dark:bg-ink-800 border border-black/5 dark:border-white/5 rounded-2xl shadow-soft ${className}`}>{children}</div>
}
export function SectionHeader({ eyebrow, title, subtitle, right }: { eyebrow: string; title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-accent uppercase mb-1">{eyebrow}</p>
        <h1 className="serif text-3xl md:text-4xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-ink-900/60 dark:text-bone-100/60 mt-1">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-3">{right}</div>}
    </div>
  )
}
export function StatCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean | null }) {
  const color = positive === undefined || positive === null ? 'text-ink-900 dark:text-bone-100' : positive ? 'text-profit' : 'text-loss'
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-900/50 dark:text-bone-100/50 mb-2">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mt-1">{sub}</p>}
    </Card>
  )
}
export function PillTabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="inline-flex bg-black/5 dark:bg-white/5 p-1 rounded-full gap-1 flex-wrap">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${active === t.id ? 'bg-black/10 dark:bg-white/15 text-ink-900 dark:text-bone-100 font-semibold' : 'text-ink-900/60 dark:text-bone-100/60 hover:text-ink-900 dark:hover:text-bone-100'}`}>
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
    <div className="inline-flex rounded-xl overflow-hidden border border-black/10 dark:border-white/10">
      <button type="button" onClick={() => onChange('long')} className={`px-5 py-2 text-sm font-semibold transition ${value === 'long' ? 'bg-profit text-white' : 'bg-transparent text-ink-900/50 dark:text-bone-100/50'}`}>LONG</button>
      <button type="button" onClick={() => onChange('short')} className={`px-5 py-2 text-sm font-semibold transition ${value === 'short' ? 'bg-loss text-white' : 'bg-transparent text-ink-900/50 dark:text-bone-100/50'}`}>SHORT</button>
    </div>
  )
}
export function Gauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score))
  const radius = 80
  const circumference = Math.PI * radius
  const offset = circumference * (1 - clamped / 100)
  const color = clamped >= 70 ? '#16A34A' : clamped >= 40 ? '#D97706' : '#DC2626'
  return (
    <div className="relative flex flex-col items-center">
      <svg width="200" height="110" viewBox="0 0 200 110">
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="currentColor" className="text-black/10 dark:text-white/10" strokeWidth="14" strokeLinecap="round" />
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="absolute top-8 flex flex-col items-center">
        <span className="serif text-4xl font-semibold">{clamped}</span>
        <span className="text-[10px] uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40">Score</span>
      </div>
    </div>
  )
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-ink-900/50 dark:text-bone-100/50 mb-1.5">{label}</label>{children}</div>
}
export const inputCls = 'w-full bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40'

export function Modal({ open, onClose, children, widthClass = 'max-w-lg' }: { open: boolean; onClose: () => void; children: React.ReactNode; widthClass?: string }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white dark:bg-ink-800 rounded-2xl shadow-xl w-full ${widthClass} max-h-[90vh] overflow-y-auto p-6 md:p-8`}>
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
          ? 'bg-black/8 dark:bg-white/10 border-black/10 dark:border-white/10 text-ink-900 dark:text-bone-100 font-semibold'
          : 'border-black/10 dark:border-white/10 text-ink-900/50 dark:text-bone-100/50 hover:bg-black/5 dark:hover:bg-white/5'
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
      className={`border-2 border-dashed rounded-xl p-5 text-center transition ${dragOver ? 'border-black/30 bg-black/[0.03] dark:border-white/30 dark:bg-white/[0.03]' : 'border-black/10 dark:border-white/10'}`}>
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
    <div className="flex items-center justify-between p-5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-ink-800">
      <span className="text-sm font-medium">{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}
export function RadioRow({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect}
      className="w-full flex items-center gap-3 p-5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-ink-800 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition">
      <span className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition ${selected ? 'border-ink-900 dark:border-bone-100' : 'border-black/20 dark:border-white/20'}`}>
        {selected && <span className="w-2.5 h-2.5 rounded-full bg-ink-900 dark:bg-bone-100" />}
      </span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}
export function EmotionSliderStyled({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const pct = ((value - 1) / 9) * 100
  const zone = value <= 4 ? 'risk' : value <= 6 ? 'caution' : 'optimal'
  const zoneLabel = zone === 'optimal' ? 'Condiciones óptimas' : zone === 'caution' ? 'Operable con precaución' : 'Alto riesgo'
  const zoneColor = zone === 'optimal' ? 'text-profit' : zone === 'caution' ? 'text-amber-500' : 'text-loss'
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-lg font-medium">Estado emocional ({value}/10)</p>
        <p className={`text-sm font-semibold ${zoneColor}`}>{zoneLabel}</p>
      </div>
      <div className="relative h-2 rounded-full bg-black/10 dark:bg-white/10 mb-3">
        <div className="absolute inset-y-0 left-0 rounded-full bg-ink-900 dark:bg-bone-100 pointer-events-none" style={{ width: `${pct}%` }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 border-ink-900 dark:border-bone-100 shadow pointer-events-none" style={{ left: `calc(${pct}% - 10px)` }} />
        <input type="range" min={1} max={10} value={value} onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      </div>
      <div className="flex justify-between text-xs text-ink-900/40 dark:text-bone-100/40">
        <span>1-4 Alto riesgo</span><span>5-6 Precaución</span><span>7-10 Óptimo</span>
      </div>
    </div>
  )
}

/* ==================== BLOCK (secciones con línea divisoria) ==================== */
export function Block({ icon: Icon, title, children, first = false }: { icon: any; title: string; children: React.ReactNode; first?: boolean }) {
  return (
    <div className={first ? '' : 'border-t border-black/10 dark:border-white/10 pt-8'}>
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} className="text-accent" />
        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-900/50 dark:text-bone-100/50">{title}</h3>
      </div>
      {children}
    </div>
  )
}
export function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black/5 dark:bg-white/5 rounded-lg px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">{label}</p>
      <p className="font-semibold text-sm">{value}</p>
    </div>
  )
}