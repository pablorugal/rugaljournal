import type { ReactNode } from 'react'
import { getConfidenceLabel, CONFIDENCE_THRESHOLDS } from '../calculations'
import type { ConfidenceLevel } from '../calculations'
import { CONFIDENCE_COLORS, CONFIDENCE_BG } from '../lib/useNovaInsights'

function rangeText(level: ConfidenceLevel, unit: string): string {
  const t = CONFIDENCE_THRESHOLDS
  switch (level) {
    case 0: return `menos de ${t.exploratory} ${unit}`
    case 1: return `${t.exploratory} a ${t.emerging - 1} ${unit}`
    case 2: return `${t.emerging} a ${t.consolidated - 1} ${unit}`
    default: return `${t.consolidated} ${unit} o más`
  }
}

/**
 * Envuelve cualquier contenido y muestra un cuadro explicativo del nivel de
 * confianza al pasar el ratón (o al enfocar con teclado).
 * Se abre hacia ABAJO (no hacia arriba) para no solaparse con títulos o
 * contenido situado encima del elemento (bug visto en "Tu estado ahora").
 */
export function ConfidenceTooltip({
  level, unit = 'operaciones', children,
}: { level: ConfidenceLevel; unit?: string; children: ReactNode }) {
  const { label, description } = getConfidenceLabel(level)
  return (
    <span tabIndex={0} className="group/conf relative inline-flex cursor-help outline-none">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full right-0 z-50 mt-2 w-64 whitespace-normal rounded-xl border border-white/10 bg-ink-900 px-3.5 py-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-bone-100 opacity-0 shadow-xl transition-opacity duration-150 group-hover/conf:opacity-100 group-focus/conf:opacity-100 dark:border-ink-600 dark:bg-ink-700 dark:text-bone-100"
      >
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide opacity-70">
          {label} · {rangeText(level, unit)}
        </span>
        <span className="mb-2 block">{description}</span>
        <span className="block opacity-70">
          Indica cuántas {unit} hay detrás del dato, no si el dato es bueno o malo.
        </span>
      </span>
    </span>
  )
}

/** Badge de nivel de confianza (puntos + nombre) con cuadro explicativo. */
export function ConfidenceBadge({ level, unit }: { level: ConfidenceLevel; unit?: string }) {
  const { label } = getConfidenceLabel(level)
  return (
    <ConfidenceTooltip level={level} unit={unit}>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${CONFIDENCE_BG[level]} ${CONFIDENCE_COLORS[level]}`}
      >
        <span className="flex gap-0.5">
          {[1, 2, 3].map(i => (
            <span key={i} className={`h-1.5 w-1.5 rounded-full bg-current ${i <= level ? '' : 'opacity-25'}`} />
          ))}
        </span>
        {label}
      </span>
    </ConfidenceTooltip>
  )
}
