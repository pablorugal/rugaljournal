export type Direction = 'long' | 'short'
export type InstrumentType = 'Futuros' | 'Opciones' | 'Forex' | 'Acciones' | 'Crypto'

export interface Trade {
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
  account_id?: string | null
  rating?: number
  screenshots?: string[]
  notes?: string
  created_at: string
}

export interface Strategy { id: string; name: string; description?: string; rules?: string; created_at: string }
export interface ChecklistItem { id: string; text: string; checked?: boolean }
export interface Checklist { id: string; name: string; items: ChecklistItem[]; created_at: string }
export interface HabitRule { id: string; text: string; created_at: string }
export interface HabitLog { id: string; rule_id: string; date: string; checked: boolean }

export type BiasMarket = 'Futuros' | 'Forex' | 'Acciones'
export type BiasDirection = 'Alcista' | 'Bajista' | 'Rango' | 'Sin sesgo'
// CAMBIO: quitado 'Parcial'. Ahora solo 2 estados posibles + "sin definir" (outcome undefined = Sin confirmar)
export type BiasOutcome = 'Acertado' | 'Fallado'

export interface DailyBiasEntry {
  id: string
  date: string
  market: BiasMarket
  symbol?: string
  expected_direction: BiasDirection
  expected_description: string
  expected_screenshots?: string[]
  actual_description?: string
  actual_screenshots?: string[]
  outcome?: BiasOutcome
  created_at: string
  updated_at: string
}

export interface WeeklyOutlookEntry {
  id: string
  week_start: string
  market: BiasMarket
  description: string
  screenshots?: string[]
  created_at: string
}

export interface UserSettings {
  theme: 'light' | 'dark'
  language: 'es'
  breakeven_threshold: number
  commission_nq: number
  commission_mnq: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  imagePreview?: string
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  created_at: string
  updated_at: string
}

// CAMBIO: MindsetBias ya no se usa en MindsetEntry (el bias vive solo en BiasPage),
// se deja el tipo por si en el futuro quieres reutilizarlo en otro sitio, pero es opcional borrarlo.
export type MindsetBias = 'Alcista' | 'Bajista' | 'Sin sesgo'

// NUEVO: opciones cerradas para "qué versión de ti operó hoy"
export type TradedVersion = 'plan' | 'improviso' | 'recuperar' | 'dudo'

export interface MindsetEntry {
  id: string
  date: string
  // CAMBIO: challenge_day queda opcional para no romper datos viejos, pero ya no se escribe desde el formulario
  challenge_day?: number
  emotion?: number
  slept_well?: boolean
  emotional_baggage?: boolean
  market_structure?: '' | 'clear' | 'accumulation'
  high_impact_news?: boolean
  conviction?: boolean
  goal_today?: string
  plan_if_red?: string
  has_premarket?: boolean
  close_emotion?: number
  change_vs_start?: '' | 'mejor' | 'igual' | 'peor'
  state_before_first_trade?: string
  needed_to_recover?: boolean
  wrong_decision?: boolean
  dominant_emotion?: string
  emotion_influence?: string
  followed_plan?: '' | 'yes' | 'partial' | 'no'
  // CAMBIO: traded_version ahora es el select cerrado (para correlación en el motor de insights)
  traded_version?: TradedVersion | ''
  // NUEVO: texto libre opcional, solo para journaling, no entra en cálculos
  traded_version_note?: string
  emotional_learning?: string
  tomorrow_change?: string
  has_postsession?: boolean
  created_at: string
  updated_at: string
}

/* ==================== CUENTAS ==================== */
export type AccountCategory = 'Prop Firm' | 'Capital Real'
export type AccountPhase = 'Fase 1' | 'Fase 2' | 'Funded' | 'Challenge'
export type AccountStatus = 'Activa' | 'Funded' | 'Quemada' | 'Pausada' | 'Archivada'

export interface TradingAccount {
  id: string
  name: string
  instrument_type: InstrumentType
  category: AccountCategory
  phase?: AccountPhase | ''
  broker?: string
  status: AccountStatus
  currency: string
  initial_balance: number
  profit_target_pct?: number
  start_date?: string
  notes?: string
  created_at: string
  updated_at: string
}
export interface WeeklyReviewEntry {
  id: string
  week_start: string
  week_end: string
  content: string
  created_at: string
  updated_at: string
}

/* ==================== JOURNAL (idea #23) ==================== */
// NUEVO: anotaciones de texto libre dentro de Mindset. Varias por día, cada una con su propio id.
export interface JournalEntry {
  id: string
  date: string
  content: string
  created_at: string
  updated_at: string
}
