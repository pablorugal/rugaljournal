import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAuth, AppDataProvider } from '../contexts'
import { AppLayout } from './Sidebar'
import LoginPage from '../pages/LoginPage'
import OverviewPage from '../pages/OverviewPage'
import CalendarPage from '../pages/CalendarPage'
import AccountsPage from '../pages/AccountsPage'
import BiasPage from '../pages/BiasPage'
import TradesPage from '../pages/TradesPage'
import AnalyticsPage from '../pages/AnalyticsPage'
import StrategiesPage from '../pages/StrategiesPage'
import WeeklyReviewPage from '../pages/WeeklyReviewPage'
import MindsetPage from '../pages/MindsetPage'
import MindsetCalendarPage from '../pages/MindsetCalendarPage'
import ZenPage from '../pages/ZenPage'
import HabitsPage from '../pages/HabitsPage'
import ChecklistsPage from '../pages/ChecklistsPage'
import ImportExportPage from '../pages/ImportExportPage'
import AIChatPage from '../pages/AIChatPage'
import SettingsPage from '../pages/SettingsPage'

export function AuthGate() {
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
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="bias" element={<BiasPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="trades" element={<TradesPage />} />
            <Route path="strategies" element={<StrategiesPage />} />
            <Route path="weekly-review" element={<WeeklyReviewPage />} />
            <Route path="mindset" element={<MindsetPage />} />
            <Route path="mindset-calendar" element={<MindsetCalendarPage />} />
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