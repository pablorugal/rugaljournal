import { useState } from 'react'
import { Info } from 'lucide-react'

/**
 * Icono ⓘ reutilizable. Funciona con hover en escritorio y con tap en
 * móvil/táctil (toggle por estado + onBlur para cerrar al tocar fuera).
 */
export function InfoTooltip({ text, position = 'top' }: { text: string; position?: 'top' | 'bottom' }) {
  const [open, setOpen] = useState(false)
  const posClass = position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
  return (
    <span className="relative inline-flex align-middle ml-1.5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="flex items-center justify-center text-ink-900/30 dark:text-bone-100/30 hover:text-ink-900/60 dark:hover:text-bone-100/60 transition outline-none"
        aria-label="Más información"
      >
        <Info size={14} />
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute left-1/2 -translate-x-1/2 z-50 ${posClass} w-64 whitespace-normal rounded-xl border border-white/10 bg-ink-900 px-3.5 py-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-bone-100 shadow-xl dark:border-ink-600 dark:bg-ink-700 dark:text-bone-100`}
        >
          {text}
        </span>
      )}
    </span>
  )
}
