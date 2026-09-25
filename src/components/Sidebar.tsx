import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, CalendarDays, LineChart, Repeat, BookOpen, ClipboardList,
  Brain, Sparkles, CheckSquare, ListTodo, Upload, Bot, Sun, Moon, Settings, LogOut,
  Compass, Wallet,
} from 'lucide-react'
import { useTheme, useAuth } from '../contexts'

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
]
const toolsNav = [
  { to: '/habits', label: 'Hábitos', icon: CheckSquare },
  { to: '/checklists', label: 'Checklists', icon: ListTodo },
  { to: '/import-export', label: 'Importar/Exportar', icon: Upload },
  { to: '/ai', label: 'Nova IA', icon: Bot },
]
function NavItem({ to, label, icon: Icon, end }: { to: string; label: string; icon: any; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${isActive ? 'bg-black/8 dark:bg-white/10 text-ink-900 dark:text-bone-100 font-semibold' : 'text-ink-900/60 dark:text-bone-100/60 hover:bg-black/5 dark:hover:bg-white/5 hover:text-ink-900 dark:hover:text-bone-100'}`}>
      <Icon size={18} strokeWidth={2} /><span>{label}</span>
    </NavLink>
  )
}
export function Sidebar() {
  const { theme, toggleTheme } = useTheme()
  const { logout, user } = useAuth()
  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 flex flex-col bg-bone-100/60 dark:bg-ink-800/60 border-r border-black/5 dark:border-white/5 backdrop-blur">
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white font-serif font-bold">t</div>
          <span className="serif text-xl font-semibold">tujournal</span>
        </div>
        <p className="text-[11px] uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mt-1 ml-1">Cockpit de Rendimiento</p>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 space-y-6">
        <div className="space-y-1">{mainNav.map(item => <NavItem key={item.to} {...item} />)}</div>
        <div>
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-ink-900/35 dark:text-bone-100/35 mb-2">Herramientas</p>
          <div className="space-y-1">{toolsNav.map(item => <NavItem key={item.to} {...item} />)}</div>
        </div>
      </nav>
      <div className="px-3 py-4 border-t border-black/5 dark:border-white/5 space-y-1">
        <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/5">
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          <span>{theme === 'light' ? 'Modo oscuro' : 'Modo claro'}</span>
        </button>
        <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-loss hover:bg-loss/10">
          <LogOut size={18} />
          <span>Cerrar sesión</span>
        </button>
        <div className="flex items-center justify-between px-2 pt-2">
          <NavLink to="/settings" className="flex items-center gap-2 group min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-full bg-accent/20 text-accent flex items-center justify-center font-semibold text-sm">JT</div>
            <div className="leading-tight min-w-0"><p className="text-sm font-medium truncate">{user?.email || 'Trader'}</p><p className="text-[11px] text-ink-900/40 dark:text-bone-100/40">Cuenta fondeada</p></div>
          </NavLink>
          <NavLink to="/settings" className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"><Settings size={16} /></NavLink>
        </div>
      </div>
    </aside>
  )
}
export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-bone-50 dark:bg-ink-900">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 max-w-[1600px] mx-auto w-full"><Outlet /></main>
    </div>
  )
}