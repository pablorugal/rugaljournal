import React, { useState, useRef, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, CalendarDays, LineChart, Repeat, BookOpen, ClipboardList,
  Brain, Sparkles, CheckSquare, ListTodo, Upload, Bot, Sun, Moon, Settings, LogOut,
  Compass, Wallet, Activity, Check,
} from 'lucide-react'
import { useTheme, useAuth, type Palette } from '../contexts'

const mainNav = [
  { to: '/', label: 'Panel', icon: LayoutDashboard, end: true },
  { to: '/calendar', label: 'Calendario', icon: CalendarDays },
  { to: '/accounts', label: 'Cuentas', icon: Wallet },
  { to: '/bias', label: 'Bias Diario', icon: Compass },
  { to: '/analytics', label: 'Analítica', icon: LineChart },
  { to: '/trades', label: 'Operaciones', icon: Repeat },
  { to: '/strategies', label: 'Estrategias', icon: BookOpen },
  { to: '/weekly-review', label: 'Resumen Semanal', icon: ClipboardList },
  { to: '/mindset', label: 'Mindset', icon: Brain },
  { to: '/zen', label: 'ZEN', icon: Sparkles },
  { to: '/nova-panel', label: 'Panel Nova', icon: Activity, badge: 'IA' },
  { to: '/ai', label: 'Nova IA', icon: Bot, badge: 'IA' },
]
const toolsNav = [
  { to: '/habits', label: 'Hábitos', icon: CheckSquare },
  { to: '/checklists', label: 'Checklists', icon: ListTodo },
  { to: '/import-export', label: 'Importar/Exportar', icon: Upload },
]

const PALETTES_UI: { id: Palette; label: string; swatch: string }[] = [
  { id: 'dorado', label: 'Dorado', swatch: '#B38A3C' },
  { id: 'negro', label: 'Negro', swatch: '#18181B' },
  { id: 'grafito', label: 'Grafito', swatch: '#4A3F33' },
  { id: 'plata', label: 'Plata', swatch: '#52525B' },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 mb-2">
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-bone-100/35">{children}</p>
      <span className="h-px flex-1 bg-gradient-to-r from-accent/25 to-transparent" />
    </div>
  )
}

function NavItem({ to, label, icon: Icon, end, badge }: { to: string; label: string; icon: any; end?: boolean; badge?: string }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) =>
      `tj-nav-item group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${isActive ? 'tj-nav-active bg-transparent text-accent font-semibold' : 'text-bone-100/60 hover:bg-white/[0.04] hover:text-bone-100'}`}>
      <Icon size={18} strokeWidth={2} className="tj-nav-icon transition duration-200 group-hover:scale-110 group-hover:text-accent" />
      <span>{label}</span>
      {badge && (
        <span className="ml-auto font-mono text-[9px] font-semibold tracking-[0.14em] px-1.5 py-0.5 rounded-md border border-accent/40 text-accent bg-accent/10">{badge}</span>
      )}
    </NavLink>
  )
}

function AppearanceMenu() {
  const { theme, toggleTheme, palette, setPalette } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const active = PALETTES_UI.find(p => p.id === palette) ?? PALETTES_UI[0]

  return (
    <div ref={ref} className="relative">
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl border border-accent/20 bg-ink-800 shadow-xl p-3 z-30">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-100/40 mb-2 px-1">Paleta</p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {PALETTES_UI.map(p => (
              <button key={p.id} onClick={() => setPalette(p.id)} className="flex flex-col items-center gap-1 group" title={p.label} type="button">
                <span
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition ${palette === p.id ? 'border-accent' : 'border-white/10'}`}
                  style={{ backgroundColor: p.swatch }}
                >
                  {palette === p.id && <Check size={13} className="text-white drop-shadow" />}
                </span>
                <span className="text-[10px] text-bone-100/60 group-hover:text-bone-100">{p.label}</span>
              </button>
            ))}
          </div>
          <div className="h-px bg-white/10 mb-2" />
          <button onClick={toggleTheme} type="button" className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-sm text-bone-100 hover:bg-white/5 transition">
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            <span>{theme === 'light' ? 'Modo oscuro' : 'Modo claro'}</span>
          </button>
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} type="button" className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-bone-100 hover:bg-white/5 transition">
        <span className="w-4 h-4 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: active.swatch }} />
        <span>Apariencia</span>
        <span className="ml-auto text-bone-100/40">{theme === 'light' ? <Sun size={14} /> : <Moon size={14} />}</span>
      </button>
    </div>
  )
}

export function Sidebar() {
  const { logout, user } = useAuth()
  const { palette } = useTheme()
  return (
    <div className="dark contents" data-palette={palette !== 'dorado' ? palette : undefined}>
      <aside className="tj-sidebar w-64 shrink-0 h-screen sticky top-0 flex flex-col bg-ink-900/80 border-r border-ink-600/60 backdrop-blur">
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="tj-logo w-9 h-9 rounded-xl bg-gradient-to-br from-accent-light to-accent flex items-center justify-center text-ink-900 font-extrabold">T</div>
            <span className="text-xl font-bold tracking-tight text-bone-100">Tu<span className="text-accent">Journal</span></span>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-100/40 mt-3 ml-0.5">Cockpit de Rendimiento</p>
        </div>
        <div className="mx-5 mb-4 h-px bg-gradient-to-r from-accent/50 via-ink-600 to-transparent" />
        <nav className="tj-nav-scroll flex-1 overflow-y-auto px-3 space-y-6">
          <div>
            <SectionLabel>Navegación</SectionLabel>
            <div className="space-y-1">{mainNav.map(item => <NavItem key={item.to} {...item} />)}</div>
          </div>
          <div>
            <SectionLabel>Herramientas</SectionLabel>
            <div className="space-y-1">{toolsNav.map(item => <NavItem key={item.to} {...item} />)}</div>
          </div>
        </nav>
        <div className="px-3 py-4 border-t border-ink-600/60 space-y-1">
          <AppearanceMenu />
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-loss hover:bg-loss/10 transition">
            <LogOut size={18} />
            <span>Cerrar sesión</span>
          </button>
          <div className="tj-user mt-2 flex items-center justify-between rounded-2xl border border-ink-600 bg-ink-800/60 p-2">
            <NavLink to="/settings" className="flex items-center gap-2.5 group min-w-0">
              <div className="w-9 h-9 shrink-0 rounded-full bg-accent/20 ring-1 ring-accent/50 text-accent flex items-center justify-center font-semibold text-sm">JT</div>
              <div className="leading-tight min-w-0"><p className="text-sm font-medium truncate text-bone-100">{user?.email || 'Trader'}</p><p className="font-mono text-[10px] uppercase tracking-[0.1em] text-bone-100/40">Cuenta fondeada</p></div>
            </NavLink>
            <NavLink to="/settings" className="p-2 rounded-lg hover:bg-white/5 transition text-bone-100"><Settings size={16} /></NavLink>
          </div>
        </div>
      </aside>
    </div>
  )
}
export function AppLayout() {
  return (
    <div className="app-bg flex min-h-screen bg-bone-50 dark:bg-ink-900">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 max-w-[1600px] mx-auto w-full"><Outlet /></main>
    </div>
  )
}
