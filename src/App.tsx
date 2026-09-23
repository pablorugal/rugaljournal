import { ThemeProvider, AuthProvider } from './contexts'
import { AuthGate } from './components/AuthGate'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </ThemeProvider>
  )
}