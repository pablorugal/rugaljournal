export type Direction = 'long' | 'short'
export type InstrumentType = 'Futuros' | 'Opciones' | 'Forex' | 'Acciones'

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