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
export type BiasOutcome = 'Acertado' | 'Parcial' | 'Fallado'

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

export type MindsetBias = 'Alcista' | 'Bajista' | 'Sin sesgo'

export interface MindsetEntry {
  id: string
  date: string
  challenge_day?: number
  emotion?: number
  slept_well?: boolean
  emotional_baggage?: boolean
  market_structure?: '' | 'clear' | 'accumulation'
  daily_bias?: MindsetBias | ''
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
  traded_version?: string
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