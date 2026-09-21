import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Link, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, CalendarDays, LineChart, Repeat, BookOpen, ClipboardList,
  Brain, Sparkles, CheckSquare, ListTodo, Upload, Bot, Sun, Moon, Settings,
  Plus, ChevronLeft, ChevronRight, Star, UploadCloud, Boxes, DollarSign, Clock,
  ListChecks, Paperclip, Play, Download, Pencil, Trash2, FileDown, Send, ArrowUpDown,
  Compass, X, Check, LogOut,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

// 🔥 FIREBASE - imports
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { db, storage, auth } from './firebase'

/* ==================== TYPES ==================== */
type Direction = 'long' | 'short'
type InstrumentType = 'Futuros' | 'Opciones' | 'Forex' | 'Acciones'

interface Trade {
  id: string
  symbol: string
  instrument_type: InstrumentType
  direction: Direction
  entry_price: number
  exit_price: number
  position_size: number
  pnl: number
  risk_amount?: number
  stop_loss?: number
  take_profit?: number
  entry_datetime: string
  exit_datetime: string
  strategy_id?: string | null
  custom_setup?: string
  checklist_id?: string | null
  rating?: number
  screenshots?: string[]
  notes?: string
  created_at: string
}

interface Strategy { id: string; name: string; description?: string; rules?: string; created_at: string }
interface ChecklistItem { id: string; text: string; checked?: boolean }
interface Checklist { id: string; name: string; items: ChecklistItem[]; created_at: string }
interface HabitRule { id: string; text: string; created_at: string }
interface HabitLog { id: string; rule_id: string; date: string; checked: boolean }

/* --- BIAS DIARIO --- */
type BiasMarket = 'Futuros' | 'Forex' | 'Acciones'
type BiasDirection = 'Alcista' | 'Bajista' | 'Rango' | 'Sin sesgo'
type BiasOutcome = 'Acertado' | 'Parcial' | 'Fallado'

interface DailyBiasEntry {
  id: string
  date: string
  market: BiasMarket
  expected_direction: BiasDirection
  expected_description: string
  expected_screenshots?: string[]
  actual_description?: string
  actual_screenshots?: string[]
  outcome?: BiasOutcome
  created_at: string
  updated_at: string
}

interface WeeklyOutlookEntry {
  id: string
  week_start: string
  market: BiasMarket
  description: string
  screenshots?: string[]
  created_at: string
}

interface UserSettings {
  theme: 'light' | 'dark'
  language: 'es'
  breakeven_threshold: number
  commission_nq: number
  commission_mnq: number
}

/* ==================== UTILS ==================== */
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS_ES = ['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM']

function toISODate(d: Date) { return d.toISOString().slice(0, 10) }
function todayISO() { return toISODate(new Date()) }
function isSameDay(a: Date, b: Date) { return toISODate(a) === toISODate(b) }
function getISOWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
function getMonthMatrix(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const gridStart = new Date(year, month, 1 - startOffset)
  const weeks: Date[][] = []
  let cursor = new Date(gridStart)
  for (let w = 0; w < 6; w++) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) { week.push(new Date(cursor)); cursor.setDate(cursor.getDate() + 1) }
    weeks.push(week)
  }
  return weeks
}
function fmt(n: number) {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function getSunday(date: Date) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

/* ==================== CALCULATIONS ==================== */
function getCommissionPerContract(symbol: string, settings: UserSettings) {
  const s = symbol.toUpperCase()
  if (s.includes('MNQ')) return settings.commission_mnq
  if (s.includes('NQ')) return settings.commission_nq
  return 0
}
function getTradeCommission(trade: Trade, settings: UserSettings) {
  return getCommissionPerContract(trade.symbol, settings) * (trade.position_size || 0)
}
function getNetPnl(trade: Trade, settings: UserSettings) {
  return trade.pnl - getTradeCommission(trade, settings)
}
function classifyTrade(trade: Trade, settings: UserSettings): 'win' | 'loss' | 'be' {
  const net = getNetPnl(trade, settings)
  if (Math.abs(net) <= settings.breakeven_threshold) return 'be'
  return net > 0 ? 'win' : 'loss'
}
function computeMetrics(trades: Trade[], settings: UserSettings) {
  if (trades.length === 0) {
    return { netPnl: 0, grossPnl: 0, totalCommissions: 0, tradingDays: 0, profitFactor: 0,
      bestDay: null as any, worstDay: null as any, winRate: 0, wins: 0, losses: 0, breakevens: 0,
      equityCurve: [] as { date: string; equity: number }[], currentEquity: 0 }
  }
  const sorted = [...trades].sort((a, b) => new Date(a.exit_datetime).getTime() - new Date(b.exit_datetime).getTime())
  const byDay: Record<string, number> = {}
  let grossPnl = 0, totalCommissions = 0, wins = 0, losses = 0, breakevens = 0, grossWin = 0, grossLoss = 0
  for (const t of sorted) {
    const net = getNetPnl(t, settings)
    const day = t.exit_datetime.slice(0, 10)
    byDay[day] = (byDay[day] || 0) + net
    grossPnl += t.pnl
    totalCommissions += getTradeCommission(t, settings)
    const cls = classifyTrade(t, settings)
    if (cls === 'win') { wins++; grossWin += net } else if (cls === 'loss') { losses++; grossLoss += Math.abs(net) } else breakevens++
  }
  const days = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0]))
  let equity = 0
  const equityCurve = days.map(([date, pnl]) => { equity += pnl; return { date, equity } })
  const bestDayEntry = days.reduce((best, cur) => (cur[1] > (best?.[1] ?? -Infinity) ? cur : best), null as [string, number] | null)
  const worstDayEntry = days.reduce((worst, cur) => (cur[1] < (worst?.[1] ?? Infinity) ? cur : worst), null as [string, number] | null)
  return {
    netPnl: grossPnl - totalCommissions, grossPnl, totalCommissions, tradingDays: days.length,
    profitFactor: grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : grossWin > 0 ? Infinity : 0,
    bestDay: bestDayEntry ? { date: bestDayEntry[0], pnl: bestDayEntry[1] } : null,
    worstDay: worstDayEntry ? { date: worstDayEntry[0], pnl: worstDayEntry[1] } : null,
    winRate: wins + losses > 0 ? +((wins / (wins + losses)) * 100).toFixed(1) : 0,
    wins, losses, breakevens, equityCurve, currentEquity: equity,
  }
}
function computePerformanceScore(m: ReturnType<typeof computeMetrics>) {
  const wrScore = Math.min(m.winRate, 100) * 0.4
  const pfScore = Math.min((m.profitFactor === Infinity ? 3 : m.profitFactor) / 3, 1) * 40
  const consistencyScore = Math.min(m.tradingDays / 20, 1) * 20
  const total = wrScore * 0.5 + pfScore + consistencyScore * 0.5
  return Math.round(total > 100 ? 100 : total)
}
function computeExpectancy(trades: Trade[], settings: UserSettings) {
  if (trades.length === 0) return 0
  const total = trades.reduce((acc, t) => acc + getNetPnl(t, settings), 0)
  return +(total / trades.length).toFixed(2)
}
function computeAvgWinLoss(trades: Trade[], settings: UserSettings) {
  const wins = trades.filter(t => classifyTrade(t, settings) === 'win').map(t => getNetPnl(t, settings))
  const losses = trades.filter(t => classifyTrade(t, settings) === 'loss').map(t => getNetPnl(t, settings))
  const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0
  return { avgWin: +avgWin.toFixed(2), avgLoss: +avgLoss.toFixed(2) }
}
function computeMaxDrawdown(equityCurve: { date: string; equity: number }[]) {
  let peak = -Infinity, maxDD = 0
  for (const p of equityCurve) { peak = Math.max(peak, p.equity); maxDD = Math.min(maxDD, p.equity - peak) }
  return maxDD
}

/* ==================== THEME CONTEXT ==================== */
type Theme = 'light' | 'dark'
const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void }>({ theme: 'light', toggleTheme: () => {} })
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('tj_theme') as Theme) || 'light')
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('tj_theme', theme)
  }, [theme])
  return <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme(t => (t === 'light' ? 'dark' : 'light')) }}>{children}</ThemeContext.Provider>
}
const useTheme = () => useContext(ThemeContext)

/* ==================== AUTH CONTEXT ==================== */
interface AuthCtx {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}
const AuthContext = createContext<AuthCtx | null>(null)
function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setLoading(false) })
    return () => unsub()
  }, [])
  const login = async (email: string, password: string) => { await signInWithEmailAndPassword(auth, email, password) }
  const register = async (email: string, password: string) => { await createUserWithEmailAndPassword(auth, email, password) }
  const logout = async () => { await signOut(auth) }
  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
}
function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

/* ==================== APP DATA CONTEXT ==================== */
const DEFAULT_SETTINGS: UserSettings = { theme: 'light', language: 'es', breakeven_threshold: 10, commission_nq: 4.0, commission_mnq: 1.04 }

interface AppDataCtx {
  trades: Trade[]; addTrade: (t: Trade) => void
  strategies: Strategy[]; addStrategy: (s: Strategy) => void
  checklists: Checklist[]; addChecklist: (c: Checklist) => void; updateChecklist: (id: string, c: Partial<Checklist>) => void; deleteChecklist: (id: string) => void
  habitRules: HabitRule[]; addHabitRule: (r: HabitRule) => void
  habitLogs: HabitLog[]; toggleHabitLog: (ruleId: string, date: string) => void
  dailyBias: DailyBiasEntry[]; upsertDailyBias: (entry: DailyBiasEntry) => void
  weeklyOutlooks: WeeklyOutlookEntry[]; upsertWeeklyOutlook: (entry: WeeklyOutlookEntry) => void
  settings: UserSettings; updateSettings: (s: Partial<UserSettings>) => void
}
const AppDataContext = createContext<AppDataCtx | null>(null)

// 🔑 Ahora recibe el uid del usuario logueado y todo se guarda bajo users/{uid}/...
function AppDataProvider({ children, uid }: { children: React.ReactNode; uid: string }) {
  const cleanData = (obj: any) => JSON.parse(JSON.stringify(obj))

  /* ---------- TRADES ---------- */
  const [trades, setTrades] = useState<Trade[]>([])
  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'trades'), orderBy('created_at', 'desc'))
    const unsub = onSnapshot(q, snap => setTrades(snap.docs.map(d => d.data() as Trade)),
      err => console.error('Error al leer trades:', err))
    return () => unsub()
  }, [uid])

  /* ---------- STRATEGIES ---------- */
  const [strategies, setStrategies] = useState<Strategy[]>([])
  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'strategies'), orderBy('created_at', 'desc'))
    const unsub = onSnapshot(q, snap => setStrategies(snap.docs.map(d => d.data() as Strategy)),
      err => console.error('Error al leer strategies:', err))
    return () => unsub()
  }, [uid])

  /* ---------- CHECKLISTS ---------- */
  const [checklists, setChecklists] = useState<Checklist[]>([])
  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'checklists'), orderBy('created_at', 'desc'))
    const unsub = onSnapshot(q, snap => setChecklists(snap.docs.map(d => d.data() as Checklist)),
      err => console.error('Error al leer checklists:', err))
    return () => unsub()
  }, [uid])

  /* ---------- HABIT RULES ---------- */
  const [habitRules, setHabitRules] = useState<HabitRule[]>([])
  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'habitRules'), orderBy('created_at', 'asc'))
    const unsub = onSnapshot(q, snap => setHabitRules(snap.docs.map(d => d.data() as HabitRule)),
      err => console.error('Error al leer habitRules:', err))
    return () => unsub()
  }, [uid])

  /* ---------- HABIT LOGS ---------- */
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([])
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users', uid, 'habitLogs'), snap => setHabitLogs(snap.docs.map(d => d.data() as HabitLog)),
      err => console.error('Error al leer habitLogs:', err))
    return () => unsub()
  }, [uid])

  /* ---------- DAILY BIAS ---------- */
  const [dailyBias, setDailyBias] = useState<DailyBiasEntry[]>([])
  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'dailyBias'), orderBy('created_at', 'desc'))
    const unsub = onSnapshot(q, snap => setDailyBias(snap.docs.map(d => d.data() as DailyBiasEntry)),
      err => console.error('Error al leer dailyBias:', err))
    return () => unsub()
  }, [uid])

  /* ---------- WEEKLY OUTLOOKS ---------- */
  const [weeklyOutlooks, setWeeklyOutlooks] = useState<WeeklyOutlookEntry[]>([])
  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'weeklyOutlooks'), orderBy('created_at', 'desc'))
    const unsub = onSnapshot(q, snap => setWeeklyOutlooks(snap.docs.map(d => d.data() as WeeklyOutlookEntry)),
      err => console.error('Error al leer weeklyOutlooks:', err))
    return () => unsub()
  }, [uid])

  /* ---------- SETTINGS (documento único por usuario) ---------- */
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', uid, 'settings', 'main'), snap => {
      if (snap.exists()) {
        setSettings(snap.data() as UserSettings)
      } else {
        setDoc(doc(db, 'users', uid, 'settings', 'main'), cleanData(DEFAULT_SETTINGS)).catch(err => console.error('Error al crear settings:', err))
      }
    }, err => console.error('Error al leer settings:', err))
    return () => unsub()
  }, [uid])

  const value: AppDataCtx = {
    trades, addTrade: (t) => {
      setDoc(doc(db, 'users', uid, 'trades', t.id), cleanData(t)).catch(err => console.error('Error al guardar trade:', err))
    },

    strategies, addStrategy: (s) => {
      setDoc(doc(db, 'users', uid, 'strategies', s.id), cleanData(s)).catch(err => console.error('Error al guardar strategy:', err))
    },

    checklists,
    addChecklist: (c) => {
      setDoc(doc(db, 'users', uid, 'checklists', c.id), cleanData(c)).catch(err => console.error('Error al guardar checklist:', err))
    },
    updateChecklist: (id, c) => {
      const existing = checklists.find(x => x.id === id)
      if (!existing) return
      const updated = { ...existing, ...c }
      setDoc(doc(db, 'users', uid, 'checklists', id), cleanData(updated)).catch(err => console.error('Error al actualizar checklist:', err))
    },
    deleteChecklist: (id) => {
      deleteDoc(doc(db, 'users', uid, 'checklists', id)).catch(err => console.error('Error al eliminar checklist:', err))
    },

    habitRules, addHabitRule: (r) => {
      setDoc(doc(db, 'users', uid, 'habitRules', r.id), cleanData(r)).catch(err => console.error('Error al guardar habitRule:', err))
    },

    habitLogs,
    toggleHabitLog: (ruleId, date) => {
      const existing = habitLogs.find(l => l.rule_id === ruleId && l.date === date)
      if (existing) {
        setDoc(doc(db, 'users', uid, 'habitLogs', existing.id), cleanData({ ...existing, checked: !existing.checked }))
          .catch(err => console.error('Error al actualizar habitLog:', err))
      } else {
        const newLog: HabitLog = { id: crypto.randomUUID(), rule_id: ruleId, date, checked: true }
        setDoc(doc(db, 'users', uid, 'habitLogs', newLog.id), cleanData(newLog))
          .catch(err => console.error('Error al crear habitLog:', err))
      }
    },

    dailyBias,
    upsertDailyBias: (entry) => {
      setDoc(doc(db, 'users', uid, 'dailyBias', entry.id), cleanData(entry)).catch(err => console.error('Error al guardar dailyBias:', err))
    },

    weeklyOutlooks,
    upsertWeeklyOutlook: (entry) => {
      setDoc(doc(db, 'users', uid, 'weeklyOutlooks', entry.id), cleanData(entry)).catch(err => console.error('Error al guardar weeklyOutlook:', err))
    },

    settings,
    updateSettings: (s) => {
      const updated = { ...settings, ...s }
      setDoc(doc(db, 'users', uid, 'settings', 'main'), cleanData(updated)).catch(err => console.error('Error al guardar settings:', err))
    },
  }
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}
function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData debe usarse dentro de AppDataProvider')
  return ctx
}

/* ==================== UI COMPONENTS ==================== */
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white dark:bg-ink-800 border border-black/5 dark:border-white/5 rounded-2xl shadow-soft ${className}`}>{children}</div>
}
function SectionHeader({ eyebrow, title, subtitle, right }: { eyebrow: string; title: string; subtitle?: string; right?: React.ReactNode }) {
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
function StatCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean | null }) {
  const color = positive === undefined || positive === null ? 'text-ink-900 dark:text-bone-100' : positive ? 'text-profit' : 'text-loss'
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-900/50 dark:text-bone-100/50 mb-2">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mt-1">{sub}</p>}
    </Card>
  )
}
function PillTabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
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
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button type="button" onClick={() => onChange(!checked)} className={`w-11 h-6 rounded-full relative transition ${checked ? 'bg-accent' : 'bg-black/15 dark:bg-white/15'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  )
}
function DirectionToggle({ value, onChange }: { value: Direction; onChange: (v: Direction) => void }) {
  return (
    <div className="inline-flex rounded-xl overflow-hidden border border-black/10 dark:border-white/10">
      <button type="button" onClick={() => onChange('long')} className={`px-5 py-2 text-sm font-semibold transition ${value === 'long' ? 'bg-profit text-white' : 'bg-transparent text-ink-900/50 dark:text-bone-100/50'}`}>LONG</button>
      <button type="button" onClick={() => onChange('short')} className={`px-5 py-2 text-sm font-semibold transition ${value === 'short' ? 'bg-loss text-white' : 'bg-transparent text-ink-900/50 dark:text-bone-100/50'}`}>SHORT</button>
    </div>
  )
}
function Gauge({ score }: { score: number }) {
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
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-ink-900/50 dark:text-bone-100/50 mb-1.5">{label}</label>{children}</div>
}
const inputCls = 'w-full bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40'

function Modal({ open, onClose, children, widthClass = 'max-w-lg' }: { open: boolean; onClose: () => void; children: React.ReactNode; widthClass?: string }) {
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

/* --- Chip button reutilizable (usado en Bias Diario) --- */
function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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
function ScreenshotUploader({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
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

/* --- Componentes estilo Mindset --- */
function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-ink-800">
      <span className="text-sm font-medium">{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}
function RadioRow({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
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
function EmotionSliderStyled({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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

/* ==================== SIDEBAR & LAYOUT ==================== */
const mainNav = [
  { to: '/', label: 'Panel', icon: LayoutDashboard, end: true },
  { to: '/calendar', label: 'Calendario', icon: CalendarDays },
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
function Sidebar() {
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
function AppLayout() {
  return (
    <div className="flex min-h-screen bg-bone-50 dark:bg-ink-900">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 max-w-[1600px] mx-auto w-full"><Outlet /></main>
    </div>
  )
}

/* ==================== OVERVIEW PAGE ==================== */
function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black/5 dark:bg-white/5 rounded-lg px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">{label}</p>
      <p className="font-semibold text-sm">{value}</p>
    </div>
  )
}
function OverviewPage() {
  const { trades, strategies, settings } = useAppData()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const monthTrades = useMemo(() => trades.filter(t => {
    const d = new Date(t.exit_datetime)
    return d.getMonth() === month && d.getFullYear() === year
  }), [trades, month, year])
  const metrics = useMemo(() => computeMetrics(monthTrades, settings), [monthTrades, settings])
  const score = computePerformanceScore(metrics)
  const expectancy = computeExpectancy(monthTrades, settings)
  const maxDD = computeMaxDrawdown(metrics.equityCurve)
  const strategyPerf = useMemo(() => {
    const map: Record<string, { name: string; pnl: number; count: number; wins: number }> = {}
    monthTrades.forEach(t => {
      const strat = strategies.find(s => s.id === t.strategy_id)
      const key = strat?.name || t.custom_setup || 'Sin etiquetar'
      if (!map[key]) map[key] = { name: key, pnl: 0, count: 0, wins: 0 }
      map[key].pnl += t.pnl; map[key].count += 1
      if (t.pnl > 0) map[key].wins += 1
    })
    return Object.values(map).sort((a, b) => b.pnl - a.pnl).slice(0, 5)
  }, [monthTrades, strategies])
  const recentTrades = [...trades].sort((a, b) => new Date(b.exit_datetime).getTime() - new Date(a.exit_datetime).getTime()).slice(0, 5)

  return (
    <div>
      <SectionHeader eyebrow="Dashboard" title="Overview" subtitle="Tu rendimiento consolidado del periodo seleccionado."
        right={
          <div className="flex items-center gap-3">
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="bg-white dark:bg-ink-800 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm">
              {MONTHS_ES.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="bg-white dark:bg-ink-800 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm">
              {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <Link to="/zen" className="flex items-center gap-2 px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"><Sparkles size={16} /> ZEN</Link>
            <Link to="/trades" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light"><Plus size={16} /> New Trade</Link>
          </div>
        } />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard label="Net P&L" value={fmt(metrics.netPnl)} positive={metrics.netPnl >= 0} />
        <StatCard label="P&L Bruto" value={fmt(metrics.grossPnl)} sub={`Comisiones: -${metrics.totalCommissions.toFixed(2)}`} positive={metrics.grossPnl >= 0} />
        <StatCard label="Trading Days" value={String(metrics.tradingDays)} />
        <StatCard label="Profit Factor" value={metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)} positive={metrics.profitFactor >= 1} />
        <StatCard label="Best Day" value={metrics.bestDay ? fmt(metrics.bestDay.pnl) : '—'} positive={metrics.bestDay ? metrics.bestDay.pnl >= 0 : null} />
        <StatCard label="Win Rate" value={`${metrics.winRate}%`} sub={`${metrics.wins}W / ${metrics.losses}L`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <Card className="xl:col-span-2 p-6">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40">Equity Curve</p>
              <h3 className="serif text-2xl font-semibold">{fmt(metrics.currentEquity)}</h3>
            </div>
            <div className="flex gap-4 text-xs">
              <div className="text-right"><p className="text-ink-900/40 dark:text-bone-100/40">Current</p><p className="font-semibold">{fmt(metrics.currentEquity)}</p></div>
              <div className="text-right"><p className="text-ink-900/40 dark:text-bone-100/40">Best day</p><p className="font-semibold text-profit">{metrics.bestDay ? fmt(metrics.bestDay.pnl) : '—'}</p></div>
              <div className="text-right"><p className="text-ink-900/40 dark:text-bone-100/40">Worst day</p><p className="font-semibold text-loss">{metrics.worstDay ? fmt(metrics.worstDay.pnl) : '—'}</p></div>
            </div>
          </div>
          {metrics.equityCurve.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-ink-900/30 dark:text-bone-100/30 text-sm">No equity data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={metrics.equityCurve}>
                <defs><linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#111318" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#111318" stopOpacity={0} />
                </linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.08} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="equity" stroke="#111318" strokeWidth={2} fill="url(#equityGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6 flex flex-col items-center">
          <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 self-start mb-2">Performance Score</p>
          <Gauge score={score} />
          <p className="text-xs text-center text-ink-900/50 dark:text-bone-100/50 mt-3 mb-4">Combina tu winrate, profit factor y consistencia para estimar tu nivel de ejecución este periodo.</p>
          <div className="grid grid-cols-2 gap-3 w-full text-sm">
            <MiniMetric label="Winrate" value={`${metrics.winRate}%`} />
            <MiniMetric label="Max DD" value={fmt(maxDD)} />
            <MiniMetric label="Profit Factor" value={metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)} />
            <MiniMetric label="Sharpe" value="—" />
            <MiniMetric label="Sortino" value="—" />
            <MiniMetric label="Expectancy" value={fmt(expectancy)} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="serif text-xl font-semibold mb-4">Estrategias top</h3>
          {strategyPerf.length === 0 ? <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no hay trades etiquetados con una estrategia.</p> : (
            <div className="space-y-3">
              {strategyPerf.map(s => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <div><p className="font-medium">{s.name}</p><p className="text-xs text-ink-900/40 dark:text-bone-100/40">{s.count} trades · {Math.round((s.wins / s.count) * 100)}% WR</p></div>
                  <span className={`font-semibold ${s.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(s.pnl)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="serif text-xl font-semibold">Trades recientes</h3>
            <Link to="/trades" className="text-xs font-medium text-accent hover:underline">Últimos 10</Link>
          </div>
          {recentTrades.length === 0 ? <p className="text-sm text-ink-900/40 dark:text-bone-100/40">No hay operaciones registradas todavía.</p> : (
            <div className="space-y-2">
              {recentTrades.map(t => (
                <div key={t.id} className="flex items-center justify-between text-sm py-2 border-b border-black/5 dark:border-white/5 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded ${t.direction === 'long' ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'}`}>{t.direction.toUpperCase()}</span>
                    <div><p className="font-medium">{t.symbol}</p><p className="text-xs text-ink-900/40 dark:text-bone-100/40">{new Date(t.exit_datetime).toLocaleDateString()}</p></div>
                  </div>
                  <span className={`font-semibold ${t.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(t.pnl)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

/* ==================== CALENDAR PAGE ==================== */
function CalendarPage() {
  const { trades, settings } = useAppData()
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const year = cursor.getFullYear(), month = cursor.getMonth()
  const weeks = useMemo(() => getMonthMatrix(year, month), [year, month])
  const monthTrades = useMemo(() => trades.filter(t => {
    const d = new Date(t.exit_datetime); return d.getMonth() === month && d.getFullYear() === year
  }), [trades, month, year])
  const metrics = useMemo(() => computeMetrics(monthTrades, settings), [monthTrades, settings])
  const pnlByDay = useMemo(() => {
    const map: Record<string, { pnl: number; count: number }> = {}
    trades.forEach(t => {
      const key = t.exit_datetime.slice(0, 10)
      if (!map[key]) map[key] = { pnl: 0, count: 0 }
      map[key].pnl += t.pnl; map[key].count += 1
    })
    return map
  }, [trades])
  const goToToday = () => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
  const goPrev = () => setCursor(new Date(year, month - 1, 1))
  const goNext = () => setCursor(new Date(year, month + 1, 1))

  return (
    <div>
      <SectionHeader eyebrow="Calendar" title={`${MONTHS_ES[month]} ${year}`} subtitle={`${metrics.tradingDays} días activos · ${monthTrades.length} trades · Total ${fmt(metrics.netPnl)}`} />
      <div className="flex items-center justify-center gap-4 mb-6">
        <button onClick={goPrev} className="p-2 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"><ChevronLeft size={18} /></button>
        <button onClick={goToToday} className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">Today</button>
        <button onClick={goNext} className="p-2 rounded-lg border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"><ChevronRight size={18} /></button>
      </div>
      <Card className="p-4 overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-8 gap-2 mb-2">
            {DAYS_ES.map(d => <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 py-2">{d}</div>)}
            <div className="text-center text-[11px] font-semibold uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 py-2">SEM</div>
          </div>
          <div className="space-y-2">
            {weeks.map((week, wi) => {
              const weekNum = getISOWeek(week[0])
              let weekPnl = 0, weekCount = 0
              week.forEach(d => { const entry = pnlByDay[toISODate(d)]; if (entry) { weekPnl += entry.pnl; weekCount += entry.count } })
              return (
                <div key={wi} className="grid grid-cols-8 gap-2">
                  {week.map((d, di) => {
                    const inMonth = d.getMonth() === month
                    const entry = pnlByDay[toISODate(d)]
                    const isToday = isSameDay(d, today)
                    return (
                      <div key={di} className={`rounded-xl p-3 min-h-[80px] flex flex-col justify-between ${!inMonth ? 'bg-black/[0.02] dark:bg-white/[0.02] text-ink-900/20 dark:text-bone-100/20' : entry ? (entry.pnl >= 0 ? 'bg-profit/10' : 'bg-loss/10') : 'bg-black/[0.03] dark:bg-white/[0.03]'} ${isToday ? 'ring-2 ring-accent' : ''}`}>
                        <span className="text-xs font-medium">{d.getDate()}</span>
                        {entry && (<div><p className={`text-sm font-semibold ${entry.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(entry.pnl)}</p><p className="text-[10px] text-ink-900/40 dark:text-bone-100/40">{entry.count} trades</p></div>)}
                      </div>
                    )
                  })}
                  <div className="rounded-xl p-3 min-h-[80px] flex flex-col justify-center items-center bg-accent/5">
                    <p className="text-[10px] uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">Sem {weekNum}</p>
                    <p className={`text-sm font-semibold ${weekPnl >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(weekPnl)}</p>
                    <p className="text-[10px] text-ink-900/40 dark:text-bone-100/40">{weekCount} trades</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Card>
    </div>
  )
}

/* ==================== BIAS DIARIO PAGE ==================== */
const BIAS_MARKETS: BiasMarket[] = ['Futuros', 'Forex', 'Acciones']
const BIAS_DIRECTIONS: BiasDirection[] = ['Alcista', 'Bajista', 'Rango', 'Sin sesgo']

async function uploadBiasFiles(files: File[], pathPrefix: string): Promise<string[]> {
  return Promise.all(files.map(async (file, i) => {
    const fileRef = ref(storage, `${pathPrefix}/${Date.now()}_${i}_${file.name}`)
    await uploadBytes(fileRef, file)
    return getDownloadURL(fileRef)
  }))
}

function BiasPage() {
  const { dailyBias, upsertDailyBias, weeklyOutlooks, upsertWeeklyOutlook } = useAppData()
  const { user } = useAuth()
  const uid = user!.uid
  const [market, setMarket] = useState<BiasMarket>('Futuros')
  const [mode, setMode] = useState<'daily' | 'weekly'>('daily')

  /* --- Modo diario --- */
  const [date, setDate] = useState(todayISO())
  const [direction, setDirection] = useState<BiasDirection>('Sin sesgo')
  const [expectedDesc, setExpectedDesc] = useState('')
  const [expectedFiles, setExpectedFiles] = useState<File[]>([])
  const [actualDesc, setActualDesc] = useState('')
  const [actualFiles, setActualFiles] = useState<File[]>([])
  const [outcome, setOutcome] = useState<BiasOutcome | ''>('')
  const [savingExpected, setSavingExpected] = useState(false)
  const [savingActual, setSavingActual] = useState(false)

  const currentEntry = useMemo(() => dailyBias.find(e => e.date === date && e.market === market), [dailyBias, date, market])

  useEffect(() => {
    if (currentEntry) {
      setDirection(currentEntry.expected_direction)
      setExpectedDesc(currentEntry.expected_description)
      setActualDesc(currentEntry.actual_description || '')
      setOutcome(currentEntry.outcome || '')
    } else {
      setDirection('Sin sesgo'); setExpectedDesc(''); setActualDesc(''); setOutcome('')
    }
    setExpectedFiles([]); setActualFiles([])
  }, [date, market]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveExpected = async () => {
    setSavingExpected(true)
    try {
      const base: DailyBiasEntry = currentEntry ? { ...currentEntry } : {
        id: crypto.randomUUID(), date, market, expected_direction: direction, expected_description: expectedDesc,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }
      base.expected_direction = direction
      base.expected_description = expectedDesc
      if (expectedFiles.length) {
        const urls = await uploadBiasFiles(expectedFiles, `users/${uid}/bias/${base.id}/expected`)
        base.expected_screenshots = [...(base.expected_screenshots || []), ...urls]
      }
      base.updated_at = new Date().toISOString()
      upsertDailyBias(base)
      setExpectedFiles([])
    } catch (err) {
      console.error('Error al guardar expectativa:', err)
    } finally {
      setSavingExpected(false)
    }
  }
  const saveActual = async () => {
    setSavingActual(true)
    try {
      const base: DailyBiasEntry = currentEntry ? { ...currentEntry } : {
        id: crypto.randomUUID(), date, market, expected_direction: direction, expected_description: expectedDesc,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }
      base.actual_description = actualDesc
      base.outcome = outcome || undefined
      if (actualFiles.length) {
        const urls = await uploadBiasFiles(actualFiles, `users/${uid}/bias/${base.id}/actual`)
        base.actual_screenshots = [...(base.actual_screenshots || []), ...urls]
      }
      base.updated_at = new Date().toISOString()
      upsertDailyBias(base)
      setActualFiles([])
    } catch (err) {
      console.error('Error al guardar resultado:', err)
    } finally {
      setSavingActual(false)
    }
  }
  const marketHistory = useMemo(() => dailyBias.filter(e => e.market === market).sort((a, b) => b.date.localeCompare(a.date)), [dailyBias, market])

  /* --- Modo semanal (domingos) --- */
  const [weekStart, setWeekStart] = useState(() => toISODate(getSunday(new Date())))
  const [weekDesc, setWeekDesc] = useState('')
  const [weekFiles, setWeekFiles] = useState<File[]>([])
  const [savingWeekly, setSavingWeekly] = useState(false)
  const currentWeekEntry = useMemo(() => weeklyOutlooks.find(e => e.week_start === weekStart && e.market === market), [weeklyOutlooks, weekStart, market])

  useEffect(() => {
    setWeekDesc(currentWeekEntry ? currentWeekEntry.description : '')
    setWeekFiles([])
  }, [weekStart, market]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveWeekly = async () => {
    setSavingWeekly(true)
    try {
      const base: WeeklyOutlookEntry = currentWeekEntry ? { ...currentWeekEntry } : {
        id: crypto.randomUUID(), week_start: weekStart, market, description: weekDesc, created_at: new Date().toISOString(),
      }
      base.description = weekDesc
      if (weekFiles.length) {
        const urls = await uploadBiasFiles(weekFiles, `users/${uid}/bias-weekly/${base.id}`)
        base.screenshots = [...(base.screenshots || []), ...urls]
      }
      upsertWeeklyOutlook(base)
      setWeekFiles([])
    } catch (err) {
      console.error('Error al guardar plan semanal:', err)
    } finally {
      setSavingWeekly(false)
    }
  }
  const weeklyHistory = useMemo(() => weeklyOutlooks.filter(e => e.market === market).sort((a, b) => b.week_start.localeCompare(a.week_start)), [weeklyOutlooks, market])

  return (
    <div>
      <SectionHeader eyebrow="Bias" title="Bias Diario" subtitle="Registra lo que esperas del mercado cada día y compáralo con lo que realmente ocurrió." />

      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div className="flex gap-2">{BIAS_MARKETS.map(m => <ChipButton key={m} active={market === m} onClick={() => setMarket(m)}>{m}</ChipButton>)}</div>
        <PillTabs tabs={[{ id: 'daily', label: 'Diario' }, { id: 'weekly', label: 'Semanal (Domingos)' }]} active={mode} onChange={v => setMode(v as any)} />
      </div>

      {mode === 'daily' ? (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
              <Field label="Fecha"><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} /></Field>
              {currentEntry?.outcome && (
                <span className={`text-xs font-bold uppercase px-3 py-1.5 rounded-full ${currentEntry.outcome === 'Acertado' ? 'bg-profit/10 text-profit' : currentEntry.outcome === 'Fallado' ? 'bg-loss/10 text-loss' : 'bg-black/5 dark:bg-white/10 text-ink-900/60 dark:text-bone-100/60'}`}>{currentEntry.outcome}</span>
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-900/50 dark:text-bone-100/50 mb-4">Lo que espero ({market})</h3>
                <div className="space-y-4">
                  <Field label="Bias esperado"><div className="flex flex-wrap gap-2">{BIAS_DIRECTIONS.map(d => <ChipButton key={d} active={direction === d} onClick={() => setDirection(d)}>{d}</ChipButton>)}</div></Field>
                  <Field label="Descripción / análisis"><textarea rows={4} value={expectedDesc} onChange={e => setExpectedDesc(e.target.value)} placeholder="¿Qué esperas hoy? Niveles, estructura, catalizadores..." className={inputCls} /></Field>
                  <ScreenshotUploader files={expectedFiles} onChange={setExpectedFiles} />
                  {currentEntry?.expected_screenshots && currentEntry.expected_screenshots.length > 0 && (
                    <div className="flex gap-2 flex-wrap">{currentEntry.expected_screenshots.map((src, i) => (
                      <a key={i} href={src} target="_blank" rel="noreferrer"><img src={src} className="w-16 h-16 object-cover rounded-lg border border-black/10 dark:border-white/10" /></a>
                    ))}</div>
                  )}
                  <button onClick={saveExpected} disabled={savingExpected} className="w-full px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft disabled:opacity-50">
                    {savingExpected ? 'Guardando...' : 'Guardar expectativa'}
                  </button>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-900/50 dark:text-bone-100/50 mb-4">Lo que pasó</h3>
                {!currentEntry ? (
                  <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Primero guarda tu expectativa del día para poder registrar el resultado.</p>
                ) : (
                  <div className="space-y-4">
                    <Field label="Resultado"><div className="flex flex-wrap gap-2">{(['Acertado', 'Parcial', 'Fallado'] as BiasOutcome[]).map(o => <ChipButton key={o} active={outcome === o} onClick={() => setOutcome(o)}>{o}</ChipButton>)}</div></Field>
                    <Field label="¿Qué pasó realmente?"><textarea rows={4} value={actualDesc} onChange={e => setActualDesc(e.target.value)} placeholder="Describe cómo se comportó el mercado frente a tu expectativa..." className={inputCls} /></Field>
                    <ScreenshotUploader files={actualFiles} onChange={setActualFiles} />
                    {currentEntry?.actual_screenshots && currentEntry.actual_screenshots.length > 0 && (
                      <div className="flex gap-2 flex-wrap">{currentEntry.actual_screenshots.map((src, i) => (
                        <a key={i} href={src} target="_blank" rel="noreferrer"><img src={src} className="w-16 h-16 object-cover rounded-lg border border-black/10 dark:border-white/10" /></a>
                      ))}</div>
                    )}
                    <button onClick={saveActual} disabled={savingActual} className="w-full px-4 py-2.5 rounded-lg border border-black/10 dark:border-white/10 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50">
                      {savingActual ? 'Guardando...' : 'Guardar resultado'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="serif text-xl font-semibold mb-4">Histórico — {market}</h3>
            {marketHistory.length === 0 ? <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no tienes registros para este mercado.</p> : (
              <div className="space-y-3">
                {marketHistory.map(e => (
                  <div key={e.id} className="p-4 rounded-xl border border-black/5 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer" onClick={() => setDate(e.date)}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">{new Date(e.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-black/5 dark:bg-white/10 text-ink-900/60 dark:text-bone-100/60">{e.expected_direction}</span>
                        {e.outcome && <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${e.outcome === 'Acertado' ? 'bg-profit/10 text-profit' : e.outcome === 'Fallado' ? 'bg-loss/10 text-loss' : 'bg-black/5 dark:bg-white/10 text-ink-900/60 dark:text-bone-100/60'}`}>{e.outcome}</span>}
                      </div>
                    </div>
                    <p className="text-xs text-ink-900/50 dark:text-bone-100/50 line-clamp-1">{e.expected_description || 'Sin descripción'}</p>
                    {e.actual_description && <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mt-1 line-clamp-1">→ {e.actual_description}</p>}
                    {((e.expected_screenshots && e.expected_screenshots.length > 0) || (e.actual_screenshots && e.actual_screenshots.length > 0)) && (
                      <div className="flex gap-2 flex-wrap mt-3" onClick={ev => ev.stopPropagation()}>
                        {e.expected_screenshots?.map((src, i) => (
                          <a key={`exp-${i}`} href={src} target="_blank" rel="noreferrer">
                            <img src={src} className="w-14 h-14 object-cover rounded-lg border border-black/10 dark:border-white/10" title="Expectativa" />
                          </a>
                        ))}
                        {e.actual_screenshots?.map((src, i) => (
                          <a key={`act-${i}`} href={src} target="_blank" rel="noreferrer">
                            <img src={src} className="w-14 h-14 object-cover rounded-lg border-2 border-accent/40" title="Resultado real" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="p-6">
            <Field label="Semana (domingo de inicio)"><input type="date" value={weekStart} onChange={e => setWeekStart(toISODate(getSunday(new Date(e.target.value + 'T00:00:00'))))} className={inputCls} /></Field>
            <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mt-1 mb-4">Escribe tu plan cada domingo para la semana que comienza el {new Date(weekStart + 'T00:00:00').toLocaleDateString()}.</p>
            <Field label={`Qué espero para ${market} esta semana`}><textarea rows={5} value={weekDesc} onChange={e => setWeekDesc(e.target.value)} placeholder="Sesgo semanal, niveles clave, eventos macro..." className={inputCls} /></Field>
            <div className="mt-4"><ScreenshotUploader files={weekFiles} onChange={setWeekFiles} /></div>
            {currentWeekEntry?.screenshots && currentWeekEntry.screenshots.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-3">{currentWeekEntry.screenshots.map((src, i) => (
                <a key={i} href={src} target="_blank" rel="noreferrer"><img src={src} className="w-16 h-16 object-cover rounded-lg border border-black/10 dark:border-white/10" /></a>
              ))}</div>
            )}
            <button onClick={saveWeekly} disabled={savingWeekly} className="mt-4 px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft disabled:opacity-50">
              {savingWeekly ? 'Guardando...' : 'Guardar plan semanal'}
            </button>
          </Card>
          <Card className="p-6">
            <h3 className="serif text-xl font-semibold mb-4">Histórico semanal — {market}</h3>
            {weeklyHistory.length === 0 ? <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no tienes planes semanales para este mercado.</p> : (
              <div className="space-y-3">
                {weeklyHistory.map(e => (
                  <div key={e.id} className="p-4 rounded-xl border border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02]" onClick={() => setWeekStart(e.week_start)}>
                    <p className="text-sm font-medium mb-1">Semana del {new Date(e.week_start + 'T00:00:00').toLocaleDateString()}</p>
                    <p className="text-xs text-ink-900/50 dark:text-bone-100/50 line-clamp-2">{e.description}</p>
                    {e.screenshots && e.screenshots.length > 0 && (
                      <div className="flex gap-2 flex-wrap mt-3" onClick={ev => ev.stopPropagation()}>
                        {e.screenshots.map((src, i) => (
                          <a key={i} href={src} target="_blank" rel="noreferrer">
                            <img src={src} className="w-14 h-14 object-cover rounded-lg border border-black/10 dark:border-white/10" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

/* ==================== TRADES PAGES ==================== */
const emptyForm = {
  symbol: '', instrument_type: 'Futuros' as InstrumentType, direction: 'long' as Direction,
  entry_price: '', exit_price: '', position_size: '', pnl: '', risk_amount: '', stop_loss: '', take_profit: '',
  entry_datetime: '', exit_datetime: '', strategy_id: '', custom_setup: '', checklist_id: '', rating: 0, notes: '',
}
function Block({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} className="text-accent" />
        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-900/50 dark:text-bone-100/50">{title}</h3>
      </div>
      {children}
    </div>
  )
}
function TradeForm({ onSaved }: { onSaved: () => void }) {
  const { strategies, addStrategy, checklists, addTrade } = useAppData()
  const { user } = useAuth()
  const [form, setForm] = useState(emptyForm)
  const [useFreeSetup, setUseFreeSetup] = useState(false)
  const [newStrategyName, setNewStrategyName] = useState('')
  const [showNewStrategy, setShowNewStrategy] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)

  const set = (key: keyof typeof form) => (e: any) => {
    const value = e?.target ? e.target.value : e
    setForm(prev => ({ ...prev, [key]: value }))
  }
  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return
    const valid = Array.from(fileList).filter(f => f.size <= 5 * 1024 * 1024 && /image\/(png|jpe?g)/.test(f.type))
    setFiles(prev => [...prev, ...valid])
  }
  const clearForm = () => { setForm(emptyForm); setFiles([]); setUseFreeSetup(false) }
  const handleCreateStrategy = () => {
    if (!newStrategyName.trim()) return
    const s = { id: crypto.randomUUID(), name: newStrategyName.trim(), created_at: new Date().toISOString() }
    addStrategy(s); setForm(prev => ({ ...prev, strategy_id: s.id })); setNewStrategyName(''); setShowNewStrategy(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const tradeId = crypto.randomUUID()

    let screenshotUrls: string[] = []
    if (files.length > 0) {
      setUploading(true)
      try {
        screenshotUrls = await Promise.all(
          files.map(async (file, i) => {
            const fileRef = ref(storage, `users/${user!.uid}/trades/${tradeId}/${Date.now()}_${i}_${file.name}`)
            await uploadBytes(fileRef, file)
            return getDownloadURL(fileRef)
          })
        )
      } catch (err) {
        console.error('Error al subir screenshots:', err)
      } finally {
        setUploading(false)
      }
    }

    const trade: Trade = {
      id: tradeId, symbol: form.symbol.toUpperCase(), instrument_type: form.instrument_type, direction: form.direction,
      entry_price: Number(form.entry_price) || 0, exit_price: Number(form.exit_price) || 0, position_size: Number(form.position_size) || 0,
      pnl: Number(form.pnl) || 0, risk_amount: Number(form.risk_amount) || undefined, stop_loss: Number(form.stop_loss) || undefined,
      take_profit: Number(form.take_profit) || undefined, entry_datetime: form.entry_datetime || new Date().toISOString(),
      exit_datetime: form.exit_datetime || new Date().toISOString(), strategy_id: useFreeSetup ? null : (form.strategy_id || null),
      custom_setup: useFreeSetup ? form.custom_setup : undefined, checklist_id: form.checklist_id || null, rating: form.rating,
      screenshots: screenshotUrls, notes: form.notes, created_at: new Date().toISOString(),
    }
    addTrade(trade); clearForm(); onSaved()
  }

  return (
    <Card className="p-6 md:p-8">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center"><span className="text-lg font-bold">+</span></div>
        <h2 className="serif text-2xl font-semibold">Registrar Operación</h2>
      </div>
      <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-8 ml-12">Añade los detalles de tu trade</p>

      <form onSubmit={handleSubmit} className="space-y-10">
        <Block icon={Boxes} title="Instrumento">
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Símbolo"><input value={form.symbol} onChange={set('symbol')} placeholder="NQ, MNQ, ES, EURUSD..." className={inputCls} /></Field>
            <Field label="Tipo"><select value={form.instrument_type} onChange={set('instrument_type')} className={inputCls}><option>Futuros</option><option>Opciones</option><option>Forex</option><option>Acciones</option></select></Field>
            <Field label="Dirección"><DirectionToggle value={form.direction} onChange={v => setForm(p => ({ ...p, direction: v }))} /></Field>
          </div>
        </Block>
        <Block icon={DollarSign} title="Precios y Resultado">
          <div className="grid md:grid-cols-4 gap-4">
            <Field label="Precio Entrada"><input type="number" step="0.01" value={form.entry_price} onChange={set('entry_price')} className={inputCls} /></Field>
            <Field label="Precio Salida"><input type="number" step="0.01" value={form.exit_price} onChange={set('exit_price')} className={inputCls} /></Field>
            <Field label="Tamaño Posición (contratos)"><input type="number" value={form.position_size} onChange={set('position_size')} className={inputCls} /></Field>
            <Field label="P&L $ (manual)"><input type="number" step="0.01" placeholder="+250 / -120" value={form.pnl} onChange={set('pnl')} className={inputCls} /></Field>
            <Field label="Riesgo $"><input type="number" step="0.01" value={form.risk_amount} onChange={set('risk_amount')} className={inputCls} /></Field>
            <Field label="Stop Loss"><input type="number" step="0.01" value={form.stop_loss} onChange={set('stop_loss')} className={inputCls} /></Field>
            <Field label="Take Profit"><input type="number" step="0.01" value={form.take_profit} onChange={set('take_profit')} className={inputCls} /></Field>
          </div>
        </Block>
        <Block icon={Clock} title="Tiempo">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Fecha/Hora Entrada"><input type="datetime-local" value={form.entry_datetime} onChange={set('entry_datetime')} className={inputCls} /></Field>
            <Field label="Fecha/Hora Salida"><input type="datetime-local" value={form.exit_datetime} onChange={set('exit_datetime')} className={inputCls} /></Field>
          </div>
        </Block>
        <Block icon={BookOpen} title="Estrategia">
          <div className="flex items-center gap-2 mb-3">
            <button type="button" onClick={() => setUseFreeSetup(false)} className={`text-xs px-3 py-1 rounded-full ${!useFreeSetup ? 'bg-black/8 dark:bg-white/10 text-ink-900 dark:text-bone-100 font-semibold' : 'bg-black/5 dark:bg-white/5 text-ink-900/60 dark:text-bone-100/60'}`}>Playbook</button>
            <button type="button" onClick={() => setUseFreeSetup(true)} className={`text-xs px-3 py-1 rounded-full ${useFreeSetup ? 'bg-black/8 dark:bg-white/10 text-ink-900 dark:text-bone-100 font-semibold' : 'bg-black/5 dark:bg-white/5 text-ink-900/60 dark:text-bone-100/60'}`}>Setup libre</button>
          </div>
          {!useFreeSetup ? (
            strategies.length === 0 ? (
              !showNewStrategy ? (
                <button type="button" onClick={() => setShowNewStrategy(true)} className="text-sm text-accent font-medium hover:underline">No hay estrategias guardadas · Crear una</button>
              ) : (
                <div className="flex gap-2">
                  <input value={newStrategyName} onChange={e => setNewStrategyName(e.target.value)} placeholder="Nombre de la estrategia" className={inputCls} />
                  <button type="button" onClick={handleCreateStrategy} className="px-4 rounded-lg bg-accent text-white text-sm font-medium">Crear</button>
                </div>
              )
            ) : (
              <div className="flex gap-2 items-center">
                <select value={form.strategy_id} onChange={set('strategy_id')} className={inputCls}>
                  <option value="">Selecciona un setup del playbook</option>
                  {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button type="button" onClick={() => setShowNewStrategy(true)} className="text-xs text-accent whitespace-nowrap">+ Crear</button>
              </div>
            )
          ) : (
            <Field label="Setup del día (texto libre)"><input value={form.custom_setup} onChange={set('custom_setup')} placeholder="Ej: Ruptura de rango premarket" className={inputCls} /></Field>
          )}
        </Block>
        <Block icon={ListChecks} title="Confluencias y Rating">
          <div className="grid md:grid-cols-2 gap-4 items-end">
            <Field label="Checklist asociado">
              <select value={form.checklist_id} onChange={set('checklist_id')} className={inputCls}>
                <option value="">Sin checklist</option>
                {checklists.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Rating (1-10)">
              <div className="flex gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <button key={i} type="button" onClick={() => setForm(p => ({ ...p, rating: i + 1 }))}>
                    <Star size={20} className={i < form.rating ? 'fill-amber-400 text-amber-400' : 'text-black/15 dark:text-white/15'} />
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </Block>
        <Block icon={Paperclip} title="Adjuntos y Notas">
          <div onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
            className={`border-2 border-dashed rounded-xl p-6 text-center mb-4 transition ${dragOver ? 'border-accent bg-accent/5' : 'border-black/10 dark:border-white/10'}`}>
            <UploadCloud className="mx-auto mb-2 text-ink-900/30 dark:text-bone-100/30" />
            <p className="text-sm text-ink-900/50 dark:text-bone-100/50">Arrastra tus screenshots aquí o</p>
            <label className="text-accent text-sm font-medium cursor-pointer hover:underline">
              selecciona archivos
              <input type="file" accept="image/png,image/jpeg" multiple hidden onChange={e => handleFiles(e.target.files)} />
            </label>
            <p className="text-[11px] text-ink-900/30 dark:text-bone-100/30 mt-1">PNG/JPG hasta 5MB</p>
            {files.length > 0 && <p className="text-xs mt-3 text-accent">{files.length} archivo(s) seleccionado(s)</p>}
          </div>
          <Field label="Notas"><textarea value={form.notes} onChange={set('notes')} rows={4} placeholder="¿Qué viste? ¿Cómo gestionaste la operación?" className={inputCls} /></Field>
        </Block>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={clearForm} className="px-5 py-2.5 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">Limpiar</button>
          <button type="submit" disabled={uploading} className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light disabled:opacity-50">
            {uploading ? 'Subiendo capturas...' : '+ Registrar Trade'}
          </button>
        </div>
      </form>
    </Card>
  )
}
function TradeHistory() {
  const { trades, strategies, settings } = useAppData()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<'exit_datetime' | 'symbol' | 'pnl'>('exit_datetime')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)

  const filtered = useMemo(() => {
    let list = trades.filter(t => t.symbol.toLowerCase().includes(search.toLowerCase()))
    list = list.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'symbol') cmp = a.symbol.localeCompare(b.symbol)
      if (sortKey === 'pnl') cmp = a.pnl - b.pnl
      if (sortKey === 'exit_datetime') cmp = new Date(a.exit_datetime).getTime() - new Date(b.exit_datetime).getTime()
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [trades, search, sortKey, sortDir])
  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc')); else { setSortKey(key); setSortDir('desc') }
  }

  const selectedStrat = selectedTrade ? strategies.find(s => s.id === selectedTrade.strategy_id) : null
  const selectedNet = selectedTrade ? getNetPnl(selectedTrade, settings) : 0
  const selectedCls = selectedTrade ? classifyTrade(selectedTrade, settings) : null

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="serif text-xl font-semibold">Historial de Operaciones</h3>
        <input placeholder="Buscar símbolo..." value={search} onChange={e => setSearch(e.target.value)} className="bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm w-56" />
      </div>
      {trades.length === 0 ? <p className="text-sm text-ink-900/40 dark:text-bone-100/40 py-10 text-center">Aún no has registrado ninguna operación.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40 border-b border-black/5 dark:border-white/5">
                <th className="py-3 cursor-pointer" onClick={() => toggleSort('exit_datetime')}><span className="flex items-center gap-1">Fecha <ArrowUpDown size={12} /></span></th>
                <th className="py-3 cursor-pointer" onClick={() => toggleSort('symbol')}><span className="flex items-center gap-1">Símbolo <ArrowUpDown size={12} /></span></th>
                <th className="py-3">Dirección</th><th className="py-3">Estrategia</th><th className="py-3">Rating</th>
                <th className="py-3 cursor-pointer" onClick={() => toggleSort('pnl')}><span className="flex items-center gap-1">P&L Bruto <ArrowUpDown size={12} /></span></th>
                <th className="py-3">P&L Neto</th><th className="py-3">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const strat = strategies.find(s => s.id === t.strategy_id)
                const net = getNetPnl(t, settings)
                const cls = classifyTrade(t, settings)
                return (
                  <tr key={t.id} onClick={() => setSelectedTrade(t)} className="border-b border-black/5 dark:border-white/5 last:border-0 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <td className="py-3">{new Date(t.exit_datetime).toLocaleString()}</td>
                    <td className="py-3 font-medium">{t.symbol}</td>
                    <td className="py-3"><span className={`text-[10px] font-bold px-2 py-1 rounded ${t.direction === 'long' ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'}`}>{t.direction.toUpperCase()}</span></td>
                    <td className="py-3">{strat?.name || t.custom_setup || '—'}</td>
                    <td className="py-3">{t.rating ? `${t.rating}/10` : '—'}</td>
                    <td className={`py-3 font-medium ${t.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(t.pnl)}</td>
                    <td className={`py-3 font-medium ${net >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(net)}</td>
                    <td className="py-3"><span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${cls === 'win' ? 'bg-profit/10 text-profit' : cls === 'loss' ? 'bg-loss/10 text-loss' : 'bg-amber-400/10 text-amber-500'}`}>{cls === 'be' ? 'breakeven' : cls}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!selectedTrade} onClose={() => setSelectedTrade(null)} widthClass="max-w-2xl">
        {selectedTrade && (
          <div>
            <div className="flex items-start justify-between mb-6 pr-8">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className={`text-xs font-bold px-2 py-1 rounded ${selectedTrade.direction === 'long' ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'}`}>{selectedTrade.direction.toUpperCase()}</span>
                  <h2 className="serif text-2xl font-semibold">{selectedTrade.symbol}</h2>
                </div>
                <p className="text-xs text-ink-900/40 dark:text-bone-100/40">{new Date(selectedTrade.exit_datetime).toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <MiniMetric label="Entrada" value={String(selectedTrade.entry_price)} />
              <MiniMetric label="Salida" value={String(selectedTrade.exit_price)} />
              <MiniMetric label="Tamaño" value={String(selectedTrade.position_size)} />
              <MiniMetric label="Rating" value={selectedTrade.rating ? `${selectedTrade.rating}/10` : '—'} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <StatCard label="P&L Bruto" value={fmt(selectedTrade.pnl)} positive={selectedTrade.pnl >= 0} />
              <StatCard label="P&L Neto" value={fmt(selectedNet)} positive={selectedNet >= 0} />
              <StatCard label="Resultado" value={selectedCls === 'be' ? 'Breakeven' : selectedCls === 'win' ? 'Ganadora' : 'Perdedora'} positive={selectedCls === 'win' ? true : selectedCls === 'loss' ? false : null} />
            </div>

            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-1">Estrategia</p>
              <p className="text-sm">{selectedStrat?.name || selectedTrade.custom_setup || 'Sin etiquetar'}</p>
            </div>

            {selectedTrade.notes && (
              <div className="mb-6">
                <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-1">Notas</p>
                <p className="text-sm whitespace-pre-wrap">{selectedTrade.notes}</p>
              </div>
            )}

            {selectedTrade.screenshots && selectedTrade.screenshots.length > 0 ? (
              <div>
                <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-2">Screenshots</p>
                <div className="grid grid-cols-2 gap-3">
                  {selectedTrade.screenshots.map((src, i) => (
                    <a key={i} href={src} target="_blank" rel="noreferrer">
                      <img src={src} className="w-full h-48 object-cover rounded-lg border border-black/10 dark:border-white/10 hover:opacity-90 transition" />
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink-900/30 dark:text-bone-100/30">Este trade no tiene capturas adjuntas.</p>
            )}
          </div>
        )}
      </Modal>
    </Card>
  )
}
function TradesPage() {
  const [tab, setTab] = useState('new')
  return (
    <div>
      <SectionHeader eyebrow="Trades" title="Operaciones" subtitle="Registra y revisa cada una de tus operaciones." />
      <div className="mb-6"><PillTabs tabs={[{ id: 'new', label: 'Nuevo Trade' }, { id: 'history', label: 'Historial' }]} active={tab} onChange={setTab} /></div>
      {tab === 'new' ? <TradeForm onSaved={() => setTab('history')} /> : <TradeHistory />}
    </div>
  )
}

/* ==================== ANALYTICS PAGE ==================== */
function AnalyticsPage() {
  const [tab, setTab] = useState('overview')
  const { trades, settings } = useAppData()
  const metrics = computeMetrics(trades, settings)
  const expectancy = computeExpectancy(trades, settings)
  const { avgWin, avgLoss } = computeAvgWinLoss(trades, settings)
  const maxDD = computeMaxDrawdown(metrics.equityCurve)
  const bySymbol = trades.reduce((acc: Record<string, { pnl: number; count: number }>, t) => {
    if (!acc[t.symbol]) acc[t.symbol] = { pnl: 0, count: 0 }
    acc[t.symbol].pnl += t.pnl; acc[t.symbol].count += 1
    return acc
  }, {})
  return (
    <div>
      <SectionHeader eyebrow="Analytics" title="Performance Analytics" subtitle="Métricas profundas sobre tu trading." />
      <div className="mb-6"><PillTabs tabs={[{ id: 'overview', label: 'Overview' }, { id: 'risk', label: 'Risk' }, { id: 'instrument', label: 'Instrument' }, { id: 'session', label: 'Session' }, { id: 'distribution', label: 'Distribution' }]} active={tab} onChange={setTab} /></div>
      {tab === 'overview' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Net P&L" value={fmt(metrics.netPnl)} positive={metrics.netPnl >= 0} />
          <StatCard label="Profit Factor" value={metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)} positive={metrics.profitFactor >= 1} />
          <StatCard label="Expectancy" value={fmt(expectancy)} positive={expectancy >= 0} />
          <StatCard label="Recovery Factor" value={maxDD !== 0 ? (metrics.netPnl / Math.abs(maxDD)).toFixed(2) : '—'} />
          <StatCard label="Avg Win" value={fmt(avgWin)} positive />
          <StatCard label="Avg Loss" value={fmt(avgLoss)} positive={false} />
          <StatCard label="Sharpe" value="—" />
          <StatCard label="Sortino" value="—" />
        </div>
      )}
      {tab === 'risk' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Max Drawdown" value={fmt(maxDD)} positive={false} />
          <StatCard label="Tamaño posición medio" value={trades.length ? (trades.reduce((a, t) => a + t.position_size, 0) / trades.length).toFixed(1) : '—'} />
          <StatCard label="Ratio Riesgo/Beneficio" value="—" />
        </div>
      )}
      {tab === 'instrument' && (
        <Card className="p-6">
          {Object.keys(bySymbol).length === 0 ? <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no hay datos por instrumento.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-ink-900/40 dark:text-bone-100/40 border-b border-black/5 dark:border-white/5"><th className="py-2">Símbolo</th><th className="py-2">Trades</th><th className="py-2">P&L</th></tr></thead>
              <tbody>{Object.entries(bySymbol).map(([sym, d]) => (
                <tr key={sym} className="border-b border-black/5 dark:border-white/5 last:border-0"><td className="py-2 font-medium">{sym}</td><td className="py-2">{d.count}</td><td className={`py-2 font-semibold ${d.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(d.pnl)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Card>
      )}
      {tab === 'session' && <Card className="p-6"><p className="text-sm text-ink-900/40 dark:text-bone-100/40">Rendimiento por sesión de mercado — próximamente.</p></Card>}
      {tab === 'distribution' && <Card className="p-6"><p className="text-sm text-ink-900/40 dark:text-bone-100/40">Histograma de distribución de P&L — próximamente.</p></Card>}
    </div>
  )
}

/* ==================== STRATEGIES PAGE ==================== */
function StrategiesPage() {
  const { strategies, addStrategy, trades } = useAppData()
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rules, setRules] = useState('')

  const resetForm = () => { setName(''); setDescription(''); setRules('') }

  const create = () => {
    if (!name.trim()) return
    addStrategy({
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim() || undefined,
      rules: rules.trim() || undefined,
      created_at: new Date().toISOString(),
    })
    resetForm()
    setShowModal(false)
  }

  const perf = strategies.map(s => {
    const st = trades.filter(t => t.strategy_id === s.id)
    const wins = st.filter(t => t.pnl > 0).length
    return { ...s, count: st.length, wins, pnl: st.reduce((a, t) => a + t.pnl, 0) }
  })

  return (
    <div>
      <SectionHeader eyebrow="Playbook" title="Estrategias" subtitle="Tu librería de setups y su rendimiento real."
        right={
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light">
            <Plus size={16} /> Nueva estrategia
          </button>
        } />

      <div className="mb-8">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-3">Mis estrategias</h3>
        {strategies.length === 0 ? (
          <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no has creado ninguna estrategia. Crea la primera para empezar a etiquetar tus trades.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {strategies.map(s => (
              <Card key={s.id} className="p-5">
                <h4 className="font-semibold mb-1">{s.name}</h4>
                <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mb-3">{s.description || 'Sin descripción todavía.'}</p>
                {s.rules && (
                  <div className="text-xs text-ink-900/60 dark:text-bone-100/60 whitespace-pre-wrap border-t border-black/5 dark:border-white/5 pt-2 mt-2">
                    {s.rules}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-3">Rendimiento por setup</h3>
        <Card className="p-6">
          {perf.every(p => p.count === 0) ? (
            <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no has etiquetado ninguna estrategia en tus trades.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-900/40 dark:text-bone-100/40 border-b border-black/5 dark:border-white/5">
                  <th className="py-2">Setup</th><th className="py-2">Trades</th><th className="py-2">Win Rate</th><th className="py-2">P&L</th>
                </tr>
              </thead>
              <tbody>
                {perf.map(p => (
                  <tr key={p.id} className="border-b border-black/5 dark:border-white/5 last:border-0">
                    <td className="py-2 font-medium">{p.name}</td>
                    <td className="py-2">{p.count}</td>
                    <td className="py-2">{p.count ? Math.round((p.wins / p.count) * 100) : 0}%</td>
                    <td className={`py-2 font-semibold ${p.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>${p.pnl.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Modal open={showModal} onClose={() => { setShowModal(false); resetForm() }}>
        <h2 className="serif text-2xl font-semibold mb-1">Nueva estrategia</h2>
        <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-6">Define un setup con su descripción y las reglas que debes cumplir antes de operarlo.</p>
        <div className="space-y-4">
          <Field label="Nombre">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Breakout NY Open, FVG Pullback..." className={inputCls} />
          </Field>
          <Field label="Descripción">
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="¿En qué consiste y cuándo se aplica?" className={inputCls} />
          </Field>
          <Field label="Reglas / Confluencias">
            <textarea rows={5} value={rules} onChange={e => setRules(e.target.value)} placeholder={'• Estructura alcista en HTF\n• Liquidez tomada\n• Rechazo en zona clave'} className={inputCls} />
          </Field>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => { setShowModal(false); resetForm() }} className="px-5 py-2.5 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">Cancelar</button>
          <button onClick={create} className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light">Crear estrategia</button>
        </div>
      </Modal>
    </div>
  )
}

/* ==================== WEEKLY REVIEW PAGE ==================== */
function startOfWeek(d: Date) { const day = (d.getDay() + 6) % 7; const res = new Date(d); res.setDate(d.getDate() - day); return res }
function WeeklyReviewPage() {
  const { trades, settings } = useAppData()
  const [cursor, setCursor] = useState(startOfWeek(new Date()))
  const weekEnd = new Date(cursor); weekEnd.setDate(cursor.getDate() + 6)
  const weekTrades = useMemo(() => trades.filter(t => { const d = new Date(t.exit_datetime); return d >= cursor && d <= weekEnd }), [trades, cursor])
  const metrics = computeMetrics(weekTrades, settings)
  return (
    <div>
      <SectionHeader eyebrow="Weekly Review" title="Revisión semanal" subtitle={`${cursor.toLocaleDateString()} — ${weekEnd.toLocaleDateString()}`} />
      <div className="flex items-center justify-center gap-4 mb-6">
        <button onClick={() => setCursor(new Date(cursor.getTime() - 7 * 86400000))} className="p-2 rounded-lg border border-black/10 dark:border-white/10"><ChevronLeft size={18} /></button>
        <button onClick={() => setCursor(startOfWeek(new Date()))} className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium">Esta semana</button>
        <button onClick={() => setCursor(new Date(cursor.getTime() + 7 * 86400000))} className="p-2 rounded-lg border border-black/10 dark:border-white/10"><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="P&L Semana" value={`$${metrics.netPnl.toFixed(2)}`} positive={metrics.netPnl >= 0} />
        <StatCard label="Trades" value={`${weekTrades.length}`} sub={`${metrics.wins}W / ${metrics.losses}L`} />
        <StatCard label="Win Rate" value={`${metrics.winRate}%`} />
        <StatCard label="Días Activos" value={`${metrics.tradingDays}`} />
      </div>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card className="p-5"><p className="text-xs uppercase text-ink-900/40 dark:text-bone-100/40 mb-1">Mejor día</p><p className="text-xl font-semibold text-profit">{metrics.bestDay ? `$${metrics.bestDay.pnl.toFixed(2)}` : '—'}</p></Card>
        <Card className="p-5"><p className="text-xs uppercase text-ink-900/40 dark:text-bone-100/40 mb-1">Peor día</p><p className="text-xl font-semibold text-loss">{metrics.worstDay ? `$${metrics.worstDay.pnl.toFixed(2)}` : '—'}</p></Card>
      </div>
      <Card className="p-6">
        <h3 className="serif text-xl font-semibold mb-3">Diario de la semana</h3>
        {weekTrades.length === 0 ? <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Esta semana no tienes trades cerrados.</p> : <textarea rows={6} placeholder="¿Qué aprendiste esta semana?" className={inputCls} />}
      </Card>
    </div>
  )
}

/* ==================== MINDSET PAGE ==================== */
function MindsetPage() {
  const [tab, setTab] = useState('pre')

  /* --- Premarket --- */
  const [date, setDate] = useState(todayISO())
  const [challengeDay, setChallengeDay] = useState(1)
  const [emotion, setEmotion] = useState(7)
  const [sleptWell, setSleptWell] = useState(false)
  const [emotionalBaggage, setEmotionalBaggage] = useState(false)
  const [marketStructure, setMarketStructure] = useState<'' | 'clear' | 'accumulation'>('')
  const [highImpactNews, setHighImpactNews] = useState(false)
  const [conviction, setConviction] = useState(false)
  const [goalToday, setGoalToday] = useState('')
  const [planIfRed, setPlanIfRed] = useState('')

  /* --- Post-sesión --- */
  const [postDate, setPostDate] = useState(todayISO())
  const [postChallengeDay, setPostChallengeDay] = useState(1)
  const [closeEmotion, setCloseEmotion] = useState(5)
  const [changeVsStart, setChangeVsStart] = useState<'' | 'mejor' | 'igual' | 'peor'>('')
  const [stateBeforeFirstTrade, setStateBeforeFirstTrade] = useState('')
  const [neededToRecover, setNeededToRecover] = useState(false)
  const [wrongDecision, setWrongDecision] = useState(false)
  const [dominantEmotion, setDominantEmotion] = useState('')
  const [emotionInfluence, setEmotionInfluence] = useState('')
  const [followedPlan, setFollowedPlan] = useState<'' | 'yes' | 'partial' | 'no'>('')
  const [tradedVersion, setTradedVersion] = useState('')
  const [emotionalLearning, setEmotionalLearning] = useState('')
  const [tomorrowChange, setTomorrowChange] = useState('')

  return (
    <div>
      <SectionHeader eyebrow="Mindset" title="Mindset" subtitle="Disciplina mental: ritual premarket y revisión post-sesión."
        right={<button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium"><Download size={16} /> Exportar histórico</button>} />
      <div className="mb-6"><PillTabs tabs={[{ id: 'pre', label: 'Premarket' }, { id: 'post', label: 'Post-sesión' }]} active={tab} onChange={setTab} /></div>

      {tab === 'pre' ? (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="serif text-xl font-semibold flex items-center gap-2 mb-1"><Brain size={18} className="text-accent" /> Ritual Premarket</h3>
            <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mb-6">Antes de abrir la plataforma. Responde con honestidad.</p>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Fecha"><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} /></Field>
              <Field label="Día del reto (1-30)"><input type="number" min={1} max={30} value={challengeDay} onChange={e => setChallengeDay(Number(e.target.value))} className={inputCls} /></Field>
            </div>
          </Card>

          <Card className="p-6">
            <EmotionSliderStyled value={emotion} onChange={setEmotion} />
          </Card>

          <ToggleRow label="¿Más de 7 horas de sueño?" checked={sleptWell} onChange={setSleptWell} />
          <ToggleRow label="¿Arrastras carga emocional de días anteriores?" checked={emotionalBaggage} onChange={setEmotionalBaggage} />

          <div>
            <h3 className="text-base font-medium mb-3">Estado del mercado</h3>
            <div className="space-y-3">
              <RadioRow label="Tiene estructura clara" selected={marketStructure === 'clear'} onSelect={() => setMarketStructure('clear')} />
              <RadioRow label="Está en acumulación" selected={marketStructure === 'accumulation'} onSelect={() => setMarketStructure('accumulation')} />
            </div>
          </div>

          <ToggleRow label="¿Hay noticias de alto impacto hoy?" checked={highImpactNews} onChange={setHighImpactNews} />

          <Card className="p-6">
            <p className="text-sm font-medium mb-6">¿Puedes afirmar con convicción que estás dispuesto a perder el máximo diario en el primer trade, sin que eso cambie tu comportamiento el resto del día?</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-900/60 dark:text-bone-100/60">Sí</span>
              <Toggle checked={conviction} onChange={setConviction} />
            </div>
          </Card>

          <div>
            <h3 className="text-base font-medium mb-3">¿Qué quiero demostrarme hoy con mi forma de operar?</h3>
            <textarea rows={3} value={goalToday} onChange={e => setGoalToday(e.target.value)} placeholder="Habla del proceso, no del resultado." className={inputCls} />
          </div>

          <div>
            <h3 className="text-base font-medium mb-3">¿Cuál es mi plan si voy rojo desde el primer trade?</h3>
            <textarea rows={3} value={planIfRed} onChange={e => setPlanIfRed(e.target.value)} placeholder="Define tu límite antes de operar." className={inputCls} />
          </div>

          <button className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft">Calcular señal y guardar</button>
        </div>
      ) : (
        <Card className="p-6 md:p-8 space-y-8">
          <div>
            <h3 className="serif text-xl font-semibold flex items-center gap-2 mb-1"><Moon size={18} className="text-accent" /> Post-sesión psicológica</h3>
            <p className="text-xs text-ink-900/40 dark:text-bone-100/40">Al cerrar la plataforma. Sé brutalmente honesto.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Fecha"><input type="date" value={postDate} onChange={e => setPostDate(e.target.value)} className={inputCls} /></Field>
            <Field label="Día del reto (1-30)"><input type="number" min={1} max={30} value={postChallengeDay} onChange={e => setPostChallengeDay(Number(e.target.value))} className={inputCls} /></Field>
          </div>

          <div>
            <p className="text-base font-medium mb-4">Estado emocional al cierre ({closeEmotion}/10)</p>
            <input type="range" min={1} max={10} value={closeEmotion} onChange={e => setCloseEmotion(Number(e.target.value))}
              className="w-full accent-ink-900 dark:accent-bone-100" />
          </div>

          <div>
            <h3 className="text-base font-medium mb-3">¿Cómo ha cambiado respecto al inicio?</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <RadioRow label="Mejor" selected={changeVsStart === 'mejor'} onSelect={() => setChangeVsStart('mejor')} />
              <RadioRow label="Igual" selected={changeVsStart === 'igual'} onSelect={() => setChangeVsStart('igual')} />
              <RadioRow label="Peor" selected={changeVsStart === 'peor'} onSelect={() => setChangeVsStart('peor')} />
            </div>
          </div>

          <div>
            <h3 className="text-base font-medium mb-3">¿Cómo estabas emocionalmente antes de entrar al primer trade?</h3>
            <textarea rows={3} value={stateBeforeFirstTrade} onChange={e => setStateBeforeFirstTrade(e.target.value)}
              placeholder="Describe el estado interno, no el setup. ¿Había urgencia? ¿Calma? ¿Ansiedad?" className={inputCls} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">¿Hubo algún momento en que sentiste que necesitabas recuperar?</span>
            <Toggle checked={neededToRecover} onChange={setNeededToRecover} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">¿Tomaste alguna decisión que sabías incorrecta en el momento?</span>
            <Toggle checked={wrongDecision} onChange={setWrongDecision} />
          </div>

          <div>
            <h3 className="text-base font-medium mb-3">Emoción dominante</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {['Frustración', 'Miedo a perder', 'Codicia', 'Aburrimiento', 'Impaciencia', 'Calma', 'Otra'].map(e => (
                <RadioRow key={e} label={e} selected={dominantEmotion === e} onSelect={() => setDominantEmotion(e)} />
              ))}
            </div>
            <textarea rows={3} value={emotionInfluence} onChange={e => setEmotionInfluence(e.target.value)}
              placeholder="¿Cómo influyó en tus decisiones?" className={inputCls} />
          </div>

          <div>
            <h3 className="text-base font-medium mb-3">¿Respetaste tu plan inicial del premarket?</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <RadioRow label="Sí completamente" selected={followedPlan === 'yes'} onSelect={() => setFollowedPlan('yes')} />
              <RadioRow label="Parcialmente" selected={followedPlan === 'partial'} onSelect={() => setFollowedPlan('partial')} />
              <RadioRow label="No" selected={followedPlan === 'no'} onSelect={() => setFollowedPlan('no')} />
            </div>
          </div>

          <div>
            <h3 className="text-base font-medium mb-3">¿Qué versión de ti operó hoy, la que entrena o la que reacciona?</h3>
            <textarea rows={3} value={tradedVersion} onChange={e => setTradedVersion(e.target.value)} className={inputCls} />
          </div>

          <div>
            <h3 className="text-base font-medium mb-3">Aprendizaje emocional del día (una sola frase)</h3>
            <input value={emotionalLearning} onChange={e => setEmotionalLearning(e.target.value)} className={inputCls} />
          </div>

          <div>
            <h3 className="text-base font-medium mb-3">Una cosa concreta que haré diferente mañana</h3>
            <textarea rows={3} value={tomorrowChange} onChange={e => setTomorrowChange(e.target.value)} className={inputCls} />
          </div>

          <button className="w-full px-6 py-3 rounded-lg bg-ink-900 dark:bg-bone-100 text-bone-50 dark:text-ink-900 text-sm font-semibold shadow-soft">
            Guardar post-sesión
          </button>
        </Card>
      )}
    </div>
  )
}

/* ==================== ZEN PAGE ==================== */
function ZenPage() {
  const step = 0, total = 12
  const pct = Math.round((step / total) * 100)
  return (
    <div className="fixed inset-0 lg:relative lg:inset-auto bg-ink-900 text-bone-100 -m-6 md:-m-8 min-h-screen flex flex-col items-center justify-center p-8">
      <span className="text-[11px] font-semibold tracking-widest uppercase bg-white/10 px-3 py-1 rounded-full mb-6">Ritual Pre-sesión</span>
      <h1 className="serif text-5xl font-semibold mb-3">ZEN</h1>
      <p className="text-sm text-bone-100/50 max-w-md text-center mb-12">Respiración guiada con música ambiental, seguida de 5 minutos de meditación silenciosa.</p>
      <div className="relative w-56 h-56 flex items-center justify-center mb-10">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-accent/40 to-black/10 blur-2xl" />
        <div className="relative w-40 h-40 rounded-full border border-white/10 flex items-center justify-center"><span className="text-sm tracking-widest font-medium">LISTO</span></div>
      </div>
      <p className="text-sm text-bone-100/50 mb-6">Pulsa Comenzar ZEN y deja que tu respiración te guíe.</p>
      <div className="w-full max-w-xs mb-8">
        <div className="flex justify-between text-xs text-bone-100/40 mb-2"><span>PASO {step}/{total}</span><span>{pct}%</span></div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} /></div>
      </div>
      <button className="flex items-center gap-2 px-8 py-3 rounded-full bg-accent text-white font-semibold shadow-glow"><Play size={16} /> Comenzar ZEN</button>
    </div>
  )
}

/* ==================== HABITS PAGE ==================== */
function HabitsPage() {
  const { habitRules, addHabitRule, habitLogs, toggleHabitLog } = useAppData()
  const [text, setText] = useState('')
  const today = toISODate(new Date())
  const checkedCount = habitRules.filter(r => habitLogs.find(l => l.rule_id === r.id && l.date === today)?.checked).length
  const pct = habitRules.length ? Math.round((checkedCount / habitRules.length) * 100) : 0
  const add = () => { if (!text.trim()) return; addHabitRule({ id: crypto.randomUUID(), text: text.trim(), created_at: new Date().toISOString() }); setText('') }
  return (
    <div>
      <SectionHeader eyebrow="Herramientas" title="Hábitos" subtitle={new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-2"><p className="text-sm font-medium">Progreso de hoy</p><p className="text-sm font-semibold">{checkedCount}/{habitRules.length}</p></div>
        <div className="h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
      </Card>
      <Card className="p-6">
        <h3 className="serif text-xl font-semibold mb-1">Mis Reglas de Trading</h3>
        <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mb-4">Marca las reglas que seguiste hoy</p>
        {habitRules.length === 0 ? <p className="text-sm text-ink-900/40 dark:text-bone-100/40 mb-4">No tienes reglas configuradas.</p> : (
          <div className="space-y-2 mb-4">
            {habitRules.map(r => {
              const checked = habitLogs.find(l => l.rule_id === r.id && l.date === today)?.checked || false
              return (<label key={r.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                <input type="checkbox" checked={checked} onChange={() => toggleHabitLog(r.id, today)} className="w-4 h-4 accent-accent" />
                <span className={`text-sm ${checked ? 'line-through text-ink-900/40 dark:text-bone-100/40' : ''}`}>{r.text}</span>
              </label>)
            })}
          </div>
        )}
        <div className="flex gap-2">
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Nueva regla de trading..." className="flex-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm" />
          <button onClick={add} className="px-4 rounded-lg bg-accent text-white text-sm font-semibold">+</button>
        </div>
      </Card>
    </div>
  )
}

/* ==================== CHECKLISTS PAGE ==================== */
function ChecklistsPage() {
  const { checklists, addChecklist, updateChecklist, deleteChecklist } = useAppData()
  const [name, setName] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [itemDraft, setItemDraft] = useState<Record<string, string>>({})
  const create = () => { if (!name.trim()) return; addChecklist({ id: crypto.randomUUID(), name: name.trim(), items: [], created_at: new Date().toISOString() }); setName('') }
  const addItem = (checklistId: string) => {
    const text = itemDraft[checklistId]?.trim()
    if (!text) return
    const cl = checklists.find(c => c.id === checklistId)
    if (!cl) return
    updateChecklist(checklistId, { items: [...cl.items, { id: crypto.randomUUID(), text, checked: false }] })
    setItemDraft(prev => ({ ...prev, [checklistId]: '' }))
  }
  const toggleItem = (checklistId: string, itemId: string) => {
    const cl = checklists.find(c => c.id === checklistId)
    if (!cl) return
    updateChecklist(checklistId, { items: cl.items.map(it => it.id === itemId ? { ...it, checked: !it.checked } : it) })
  }
  return (
    <div>
      <SectionHeader eyebrow="Herramientas" title="Checklists" subtitle="Crea checklists para evaluar tus trades según las confluencias que tengan." />
      <Card className="p-6 mb-6">
        <h3 className="serif text-xl font-semibold mb-4">Mis Checklists de Confluencias</h3>
        <div className="flex gap-2 mb-6">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre de nueva checklist..." className="flex-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm" />
          <button onClick={create} className="px-4 rounded-lg bg-accent text-white text-sm font-semibold">+ Crear</button>
        </div>
        {checklists.length === 0 ? <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no tienes checklists creadas.</p> : (
          <div className="space-y-3">
            {checklists.map(cl => {
              const checkedCount = cl.items.filter(it => it.checked).length
              return (
                <div key={cl.id} className="border border-black/10 dark:border-white/10 rounded-xl">
                  <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setOpenId(openId === cl.id ? null : cl.id)}>
                    <p className="font-medium">
                      {cl.name}{' '}
                      <span className="text-xs text-ink-900/40 dark:text-bone-100/40">
                        ({checkedCount}/{cl.items.length} cumplidas)
                      </span>
                    </p>
                    <div className="flex gap-3 text-xs" onClick={e => e.stopPropagation()}>
                      <button className="flex items-center gap-1 text-ink-900/50 dark:text-bone-100/50 hover:text-accent"><Pencil size={12} /> Renombrar</button>
                      <button onClick={() => deleteChecklist(cl.id)} className="flex items-center gap-1 text-loss hover:opacity-80"><Trash2 size={12} /> Eliminar</button>
                    </div>
                  </div>
                  {openId === cl.id && (
                    <div className="p-4 pt-0 space-y-2">
                      {cl.items.map(it => (
                        <div key={it.id} className="flex items-center gap-3 py-1.5">
                          <button
                            type="button"
                            onClick={() => toggleItem(cl.id, it.id)}
                            className={`w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition ${it.checked ? 'bg-profit border-profit' : 'border-black/20 dark:border-white/20 hover:border-accent'}`}
                          >
                            {it.checked && <Check size={13} className="text-white" strokeWidth={3} />}
                          </button>
                          <p className={`text-sm ${it.checked ? 'text-ink-900/40 dark:text-bone-100/40 line-through' : 'text-ink-900/70 dark:text-bone-100/70'}`}>{it.text}</p>
                        </div>
                      ))}
                      <div className="flex gap-2 pt-2">
                        <input value={itemDraft[cl.id] || ''} onChange={e => setItemDraft(prev => ({ ...prev, [cl.id]: e.target.value }))} placeholder="Nueva confluencia..." className="flex-1 bg-bone-50 dark:bg-ink-700 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm" />
                        <button onClick={() => addItem(cl.id)} className="px-4 rounded-lg bg-accent text-white text-sm font-semibold">+</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

/* ==================== IMPORT/EXPORT PAGE ==================== */
function ImportExportPage() {
  const [tab, setTab] = useState('import')
  return (
    <div>
      <SectionHeader eyebrow="Datos" title="Importar / Exportar" />
      <div className="mb-6"><PillTabs tabs={[{ id: 'import', label: 'Importar' }, { id: 'export', label: 'Exportar' }]} active={tab} onChange={setTab} /></div>
      {tab === 'import' ? (
        <Card className="p-6">
          <h3 className="serif text-xl font-semibold mb-1">Sube tus operaciones</h3>
          <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-6">Arrastra un CSV o Excel. Detectamos duplicados automáticamente y solo añadimos lo nuevo.</p>
          <div className="border-2 border-dashed border-black/10 dark:border-white/10 rounded-xl p-10 text-center mb-4">
            <UploadCloud className="mx-auto mb-3 text-ink-900/30 dark:text-bone-100/30" size={32} />
            <p className="text-sm text-ink-900/50 dark:text-bone-100/50">CSV · XLSX · PDF, máx 5MB</p>
          </div>
          <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mb-4">Duplicados detectados por Símbolo + Fecha de entrada + Precio de entrada.</p>
          <button className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium">CSV ejemplo</button>
        </Card>
      ) : (
        <Card className="p-6">
          <h3 className="serif text-xl font-semibold mb-1">Exporta tus operaciones</h3>
          <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-6">Descarga una copia de seguridad con todas tus operaciones.</p>
          <div className="grid md:grid-cols-2 gap-4">
            {['CSV (.csv)', 'Excel (.xlsx)'].map(t => (<div key={t} className="border border-black/10 dark:border-white/10 rounded-xl p-6 flex flex-col items-center gap-3"><FileDown className="text-accent" /><p className="font-medium text-sm">{t}</p><button className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold">Descargar</button></div>))}
          </div>
        </Card>
      )}
    </div>
  )
}

/* ==================== AI CHAT PAGE ==================== */
function AIChatPage() {
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

/* ==================== SETTINGS PAGE ==================== */
function SettingsPage() {
  const { settings, updateSettings } = useAppData()
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()
  const [form, setForm] = useState(settings)
  useEffect(() => { setForm(settings) }, [settings])
  const save = () => { updateSettings(form); if (form.theme !== theme) toggleTheme() }
  return (
    <div>
      <SectionHeader eyebrow="Ajustes" title="Ajustes" />
      <Card className="p-6 mb-6">
        <h3 className="serif text-xl font-semibold mb-1">Apariencia</h3>
        <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mb-4">Personaliza cómo se ve tujournal en tu dispositivo.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Tema"><select value={form.theme} onChange={e => setForm(p => ({ ...p, theme: e.target.value as any }))} className={inputCls}><option value="light">Claro</option><option value="dark">Oscuro</option></select></Field>
          <Field label="Idioma"><select value={form.language} className={inputCls} disabled><option>🇪🇸 Español</option></select><p className="text-[11px] text-ink-900/40 dark:text-bone-100/40 mt-1">Elige tu idioma preferido para la interfaz.</p></Field>
        </div>
      </Card>
      <Card className="p-6 mb-6">
        <h3 className="serif text-xl font-semibold mb-1">Trading & comisiones</h3>
        <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mb-4">Define qué se considera breakeven y las comisiones por contrato (round-turn) que se restarán automáticamente del P&L de NQ y MNQ.</p>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Umbral de breakeven (USD)"><input type="number" value={form.breakeven_threshold} onChange={e => setForm(p => ({ ...p, breakeven_threshold: Number(e.target.value) }))} className={inputCls} /><p className="text-[11px] text-ink-900/40 dark:text-bone-100/40 mt-1">Ej. 10 → trades entre -10$ y +10$ cuentan como breakeven.</p></Field>
          <Field label="Comisión NQ (USD/contrato)"><input type="number" step="0.01" value={form.commission_nq} onChange={e => setForm(p => ({ ...p, commission_nq: Number(e.target.value) }))} className={inputCls} /><p className="text-[11px] text-ink-900/40 dark:text-bone-100/40 mt-1">Típico prop firm: ~$4.00 (Apex), ~$2.80 (Topstep).</p></Field>
          <Field label="Comisión MNQ (USD/contrato)"><input type="number" step="0.01" value={form.commission_mnq} onChange={e => setForm(p => ({ ...p, commission_mnq: Number(e.target.value) }))} className={inputCls} /><p className="text-[11px] text-ink-900/40 dark:text-bone-100/40 mt-1">Típico prop firm: ~$1.04 (Apex), ~$0.74 (Topstep).</p></Field>
        </div>
      </Card>
      <button onClick={save} className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft mb-6">💾 Guardar preferencias</button>
      <Card className="p-6">
        <h3 className="serif text-xl font-semibold mb-4">Cuenta</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div><p className="text-ink-900/40 dark:text-bone-100/40 text-xs">Email</p><p>{user?.email}</p></div>
          <div><p className="text-ink-900/40 dark:text-bone-100/40 text-xs">Tipo de cuenta</p><p>Fondeada</p></div>
        </div>
      </Card>
    </div>
  )
}

/* ==================== LOGIN PAGE ==================== */
function LoginPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password)
      }
    } catch (err: any) {
      const messages: Record<string, string> = {
        'auth/invalid-credential': 'Email o contraseña incorrectos.',
        'auth/user-not-found': 'No existe una cuenta con ese email.',
        'auth/wrong-password': 'Contraseña incorrecta.',
        'auth/email-already-in-use': 'Ya existe una cuenta con ese email.',
        'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
        'auth/invalid-email': 'El email no es válido.',
      }
      setError(messages[err.code] || 'Ha ocurrido un error. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bone-50 dark:bg-ink-900 p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center text-white font-serif font-bold text-2xl mb-3">t</div>
          <h1 className="serif text-2xl font-semibold">tujournal</h1>
          <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mt-1">Cockpit de Rendimiento</p>
        </div>
        <Card className="p-6 md:p-8">
          <h2 className="serif text-xl font-semibold mb-1">{mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}</h2>
          <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-6">
            {mode === 'login' ? 'Accede a tu diario de trading.' : 'Regístrate para empezar a usar tujournal.'}
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email">
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" className={inputCls} />
            </Field>
            <Field label="Contraseña">
              <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
            </Field>
            {error && <p className="text-xs text-loss">{error}</p>}
            <button type="submit" disabled={loading} className="w-full px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light disabled:opacity-50">
              {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>
          <p className="text-xs text-center text-ink-900/50 dark:text-bone-100/50 mt-6">
            {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
            <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }} className="text-accent font-medium hover:underline">
              {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>
        </Card>
      </div>
    </div>
  )
}

/* ==================== AUTH GATE ==================== */
function AuthGate() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bone-50 dark:bg-ink-900">
        <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Cargando...</p>
      </div>
    )
  }

  if (!user) return <LoginPage />

  return (
    <AppDataProvider uid={user.uid}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="bias" element={<BiasPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="trades" element={<TradesPage />} />
            <Route path="strategies" element={<StrategiesPage />} />
            <Route path="weekly-review" element={<WeeklyReviewPage />} />
            <Route path="mindset" element={<MindsetPage />} />
            <Route path="zen" element={<ZenPage />} />
            <Route path="habits" element={<HabitsPage />} />
            <Route path="checklists" element={<ChecklistsPage />} />
            <Route path="import-export" element={<ImportExportPage />} />
            <Route path="ai" element={<AIChatPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppDataProvider>
  )
}

/* ==================== APP ROOT ==================== */
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </ThemeProvider>
  )
}