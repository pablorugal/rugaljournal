import React, { createContext, useContext, useEffect, useState } from 'react'
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { db, auth } from './firebase'
import type {
  Trade, Strategy, Checklist, HabitRule, HabitLog,
  DailyBiasEntry, WeeklyOutlookEntry, UserSettings, Conversation, MindsetEntry, TradingAccount,
} from './types'

/* ==================== THEME CONTEXT ==================== */
type Theme = 'light' | 'dark'
const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void }>({ theme: 'light', toggleTheme: () => {} })
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('tj_theme') as Theme) || 'light')
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('tj_theme', theme)
  }, [theme])
  return <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme(t => (t === 'light' ? 'dark' : 'light')) }}>{children}</ThemeContext.Provider>
}
export const useTheme = () => useContext(ThemeContext)

/* ==================== AUTH CONTEXT ==================== */
interface AuthCtx {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}
const AuthContext = createContext<AuthCtx | null>(null)
export function AuthProvider({ children }: { children: React.ReactNode }) {
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
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

/* ==================== APP DATA CONTEXT ==================== */
const DEFAULT_SETTINGS: UserSettings = { theme: 'light', language: 'es', breakeven_threshold: 10, commission_nq: 4.0, commission_mnq: 1.04 }

interface AppDataCtx {
  trades: Trade[]; addTrade: (t: Trade) => void; updateTrade: (id: string, t: Partial<Trade>) => void; deleteTrade: (id: string) => void
  strategies: Strategy[]; addStrategy: (s: Strategy) => void
  checklists: Checklist[]; addChecklist: (c: Checklist) => void; updateChecklist: (id: string, c: Partial<Checklist>) => void; deleteChecklist: (id: string) => void
  habitRules: HabitRule[]; addHabitRule: (r: HabitRule) => void
  habitLogs: HabitLog[]; toggleHabitLog: (ruleId: string, date: string) => void
  dailyBias: DailyBiasEntry[]; upsertDailyBias: (entry: DailyBiasEntry) => void; deleteDailyBias: (id: string) => void
  weeklyOutlooks: WeeklyOutlookEntry[]; upsertWeeklyOutlook: (entry: WeeklyOutlookEntry) => void; deleteWeeklyOutlook: (id: string) => void
  mindsetEntries: MindsetEntry[]; upsertMindsetEntry: (entry: Partial<MindsetEntry> & { date: string }) => void; deleteMindsetEntry: (id: string) => void
  accounts: TradingAccount[]; upsertAccount: (a: TradingAccount) => void; deleteAccount: (id: string) => void
  settings: UserSettings; updateSettings: (s: Partial<UserSettings>) => void
  conversations: Conversation[]; upsertConversation: (c: Conversation) => void; deleteConversation: (id: string) => void
}
const AppDataContext = createContext<AppDataCtx | null>(null)

export function AppDataProvider({ children, uid }: { children: React.ReactNode; uid: string }) {
  const cleanData = (obj: any) => JSON.parse(JSON.stringify(obj))

  const [trades, setTrades] = useState<Trade[]>([])
  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'trades'), orderBy('created_at', 'desc'))
    const unsub = onSnapshot(q, snap => setTrades(snap.docs.map(d => d.data() as Trade)),
      err => console.error('Error al leer trades:', err))
    return () => unsub()
  }, [uid])

  const [strategies, setStrategies] = useState<Strategy[]>([])
  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'strategies'), orderBy('created_at', 'desc'))
    const unsub = onSnapshot(q, snap => setStrategies(snap.docs.map(d => d.data() as Strategy)),
      err => console.error('Error al leer strategies:', err))
    return () => unsub()
  }, [uid])

  const [checklists, setChecklists] = useState<Checklist[]>([])
  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'checklists'), orderBy('created_at', 'desc'))
    const unsub = onSnapshot(q, snap => setChecklists(snap.docs.map(d => d.data() as Checklist)),
      err => console.error('Error al leer checklists:', err))
    return () => unsub()
  }, [uid])

  const [habitRules, setHabitRules] = useState<HabitRule[]>([])
  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'habitRules'), orderBy('created_at', 'asc'))
    const unsub = onSnapshot(q, snap => setHabitRules(snap.docs.map(d => d.data() as HabitRule)),
      err => console.error('Error al leer habitRules:', err))
    return () => unsub()
  }, [uid])

  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([])
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users', uid, 'habitLogs'), snap => setHabitLogs(snap.docs.map(d => d.data() as HabitLog)),
      err => console.error('Error al leer habitLogs:', err))
    return () => unsub()
  }, [uid])

  const [dailyBias, setDailyBias] = useState<DailyBiasEntry[]>([])
  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'dailyBias'), orderBy('created_at', 'desc'))
    const unsub = onSnapshot(q, snap => setDailyBias(snap.docs.map(d => d.data() as DailyBiasEntry)),
      err => console.error('Error al leer dailyBias:', err))
    return () => unsub()
  }, [uid])

  const [weeklyOutlooks, setWeeklyOutlooks] = useState<WeeklyOutlookEntry[]>([])
  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'weeklyOutlooks'), orderBy('created_at', 'desc'))
    const unsub = onSnapshot(q, snap => setWeeklyOutlooks(snap.docs.map(d => d.data() as WeeklyOutlookEntry)),
      err => console.error('Error al leer weeklyOutlooks:', err))
    return () => unsub()
  }, [uid])

  const [mindsetEntries, setMindsetEntries] = useState<MindsetEntry[]>([])
  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'mindsetEntries'), orderBy('date', 'desc'))
    const unsub = onSnapshot(q, snap => setMindsetEntries(snap.docs.map(d => d.data() as MindsetEntry)),
      err => console.error('Error al leer mindsetEntries:', err))
    return () => unsub()
  }, [uid])

  const [accounts, setAccounts] = useState<TradingAccount[]>([])
  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'accounts'), orderBy('created_at', 'desc'))
    const unsub = onSnapshot(q, snap => setAccounts(snap.docs.map(d => d.data() as TradingAccount)),
      err => console.error('Error al leer accounts:', err))
    return () => unsub()
  }, [uid])

  const [conversations, setConversations] = useState<Conversation[]>([])
  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'conversations'), orderBy('updated_at', 'desc'))
    const unsub = onSnapshot(q, snap => setConversations(snap.docs.map(d => d.data() as Conversation)),
      err => console.error('Error al leer conversations:', err))
    return () => unsub()
  }, [uid])

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
    trades,
    addTrade: (t) => {
      setDoc(doc(db, 'users', uid, 'trades', t.id), cleanData(t)).catch(err => console.error('Error al guardar trade:', err))
    },
    updateTrade: (id, t) => {
      const existing = trades.find(x => x.id === id)
      if (!existing) return
      const updated = { ...existing, ...t }
      setDoc(doc(db, 'users', uid, 'trades', id), cleanData(updated)).catch(err => console.error('Error al actualizar trade:', err))
    },
    deleteTrade: (id) => {
      deleteDoc(doc(db, 'users', uid, 'trades', id)).catch(err => console.error('Error al eliminar trade:', err))
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
    deleteDailyBias: (id) => {
      deleteDoc(doc(db, 'users', uid, 'dailyBias', id)).catch(err => console.error('Error al eliminar dailyBias:', err))
    },

    weeklyOutlooks,
    upsertWeeklyOutlook: (entry) => {
      setDoc(doc(db, 'users', uid, 'weeklyOutlooks', entry.id), cleanData(entry)).catch(err => console.error('Error al guardar weeklyOutlook:', err))
    },
    deleteWeeklyOutlook: (id) => {
      deleteDoc(doc(db, 'users', uid, 'weeklyOutlooks', id)).catch(err => console.error('Error al eliminar weeklyOutlook:', err))
    },

    mindsetEntries,
    upsertMindsetEntry: (entry) => {
      const existing = mindsetEntries.find(e => e.date === entry.date)
      const now = new Date().toISOString()
      const merged: MindsetEntry = existing
        ? { ...existing, ...entry, updated_at: now }
        : ({ id: entry.date, created_at: now, updated_at: now, ...entry } as MindsetEntry)
      setDoc(doc(db, 'users', uid, 'mindsetEntries', merged.id), cleanData(merged)).catch(err => console.error('Error al guardar mindsetEntry:', err))
    },
    deleteMindsetEntry: (id) => {
      deleteDoc(doc(db, 'users', uid, 'mindsetEntries', id)).catch(err => console.error('Error al eliminar mindsetEntry:', err))
    },

    accounts,
    upsertAccount: (a) => {
      setDoc(doc(db, 'users', uid, 'accounts', a.id), cleanData(a)).catch(err => console.error('Error al guardar account:', err))
    },
    deleteAccount: (id) => {
      deleteDoc(doc(db, 'users', uid, 'accounts', id)).catch(err => console.error('Error al eliminar account:', err))
    },

    conversations,
    upsertConversation: (c) => {
      setDoc(doc(db, 'users', uid, 'conversations', c.id), cleanData(c)).catch(err => console.error('Error al guardar conversation:', err))
    },
    deleteConversation: (id) => {
      deleteDoc(doc(db, 'users', uid, 'conversations', id)).catch(err => console.error('Error al eliminar conversation:', err))
    },

    settings,
    updateSettings: (s) => {
      const updated = { ...settings, ...s }
      setDoc(doc(db, 'users', uid, 'settings', 'main'), cleanData(updated)).catch(err => console.error('Error al guardar settings:', err))
    },
  }
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}
export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData debe usarse dentro de AppDataProvider')
  return ctx
}