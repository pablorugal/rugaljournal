import React, { createContext, useContext, useEffect, useState } from 'react'
import { collection, doc, setDoc, deleteDoc, writeBatch, onSnapshot, query, orderBy } from 'firebase/firestore'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { db, auth } from './firebase'
import type {
  Trade, Strategy, Checklist, HabitRule, HabitLog,
  DailyBiasEntry, WeeklyOutlookEntry, UserSettings, Conversation, MindsetEntry, TradingAccount,
  WeeklyReviewEntry, JournalEntry,
} from './types'

/* ==================== THEME CONTEXT ==================== */
type Theme = 'light' | 'dark'
export type Palette = 'dorado' | 'negro' | 'grafito' | 'plata'
const PALETTES: Palette[] = ['dorado', 'negro', 'grafito', 'plata']
const ThemeContext = createContext<{
  theme: Theme
  toggleTheme: () => void
  palette: Palette
  setPalette: (p: Palette) => void
}>({ theme: 'light', toggleTheme: () => {}, palette: 'dorado', setPalette: () => {} })
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('tj_theme_v2') as Theme) || 'dark')
  const [palette, setPaletteState] = useState<Palette>(() => {
    const saved = localStorage.getItem('tj_palette_v1') as Palette | null
    return saved && PALETTES.includes(saved) ? saved : 'dorado'
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('tj_theme_v2', theme)
  }, [theme])
  useEffect(() => {
    if (palette === 'dorado') {
      document.documentElement.removeAttribute('data-palette')
    } else {
      document.documentElement.setAttribute('data-palette', palette)
    }
    localStorage.setItem('tj_palette_v1', palette)
  }, [palette])
  const setPalette = (p: Palette) => setPaletteState(p)
  return <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme(t => (t === 'light' ? 'dark' : 'light')), palette, setPalette }}>{children}</ThemeContext.Provider>
}
export const useTheme = () => useContext(ThemeContext)
export const PALETTE_LIST = PALETTES

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
  deleteTrades: (ids: string[]) => Promise<void>
  strategies: Strategy[]; addStrategy: (s: Strategy) => void
  checklists: Checklist[]; addChecklist: (c: Checklist) => void; updateChecklist: (id: string, c: Partial<Checklist>) => void; deleteChecklist: (id: string) => void
  habitRules: HabitRule[]; addHabitRule: (r: HabitRule) => void
  habitLogs: HabitLog[]; toggleHabitLog: (ruleId: string, date: string) => void
  dailyBias: DailyBiasEntry[]; upsertDailyBias: (entry: DailyBiasEntry) => void; deleteDailyBias: (id: string) => void
  weeklyOutlooks: WeeklyOutlookEntry[]; upsertWeeklyOutlook: (entry: WeeklyOutlookEntry) => void; deleteWeeklyOutlook: (id: string) => void
  mindsetEntries: MindsetEntry[]; upsertMindsetEntry: (entry: Partial<MindsetEntry> & { date: string }) => void; deleteMindsetEntry: (id: string) => void
  journalEntries: JournalEntry[]; addJournalEntry: (date: string, content: string) => void; updateJournalEntry: (id: string, content: string) => void; deleteJournalEntry: (id: string) => void
  accounts: TradingAccount[]; upsertAccount: (a: TradingAccount) => void; deleteAccount: (id: string) => void
  settings: UserSettings; updateSettings: (s: Partial<UserSettings>) => void
  conversations: Conversation[]; upsertConversation: (c: Conversation) => void; deleteConversation: (id: string) => void
  weeklyReviews: WeeklyReviewEntry[]; upsertWeeklyReview: (entry: Partial<WeeklyReviewEntry> & { id: string }) => void
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

  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'journalEntries'), orderBy('created_at', 'desc'))
    const unsub = onSnapshot(q, snap => setJournalEntries(snap.docs.map(d => d.data() as JournalEntry)),
      err => console.error('Error al leer journalEntries:', err))
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

  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReviewEntry[]>([])
  useEffect(() => {
    const q = query(collection(db, 'users', uid, 'weeklyReviews'), orderBy('week_start', 'desc'))
    const unsub = onSnapshot(q, snap => setWeeklyReviews(snap.docs.map(d => d.data() as WeeklyReviewEntry)),
      err => console.error('Error al leer weeklyReviews:', err))
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
    deleteTrades: async (ids: string[]) => {
      if (ids.length === 0) return
      const batch = writeBatch(db)
      ids.forEach(id => batch.delete(doc(db, 'users', uid, 'trades', id)))
      try {
        await batch.commit()
      } catch (err) {
        console.error('Error al eliminar trades en batch:', err)
        throw err
      }
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

    journalEntries,
    addJournalEntry: (date, content) => {
      const now = new Date().toISOString()
      const newEntry: JournalEntry = { id: crypto.randomUUID(), date, content, created_at: now, updated_at: now }
      setDoc(doc(db, 'users', uid, 'journalEntries', newEntry.id), cleanData(newEntry)).catch(err => console.error('Error al guardar journalEntry:', err))
    },
    updateJournalEntry: (id, content) => {
      const existing = journalEntries.find(e => e.id === id)
      if (!existing) return
      const updated: JournalEntry = { ...existing, content, updated_at: new Date().toISOString() }
      setDoc(doc(db, 'users', uid, 'journalEntries', id), cleanData(updated)).catch(err => console.error('Error al actualizar journalEntry:', err))
    },
    deleteJournalEntry: (id) => {
      deleteDoc(doc(db, 'users', uid, 'journalEntries', id)).catch(err => console.error('Error al eliminar journalEntry:', err))
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

    weeklyReviews,
    upsertWeeklyReview: (entry) => {
      const existing = weeklyReviews.find(e => e.id === entry.id)
      const now = new Date().toISOString()
      const merged: WeeklyReviewEntry = existing
        ? { ...existing, ...entry, updated_at: now }
        : ({ created_at: now, updated_at: now, content: '', week_start: '', week_end: '', ...entry } as WeeklyReviewEntry)
      setDoc(doc(db, 'users', uid, 'weeklyReviews', merged.id), cleanData(merged)).catch(err => console.error('Error al guardar weeklyReview:', err))
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
