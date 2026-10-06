import { useState } from 'react'
import { useAuth } from '../contexts'
import { Card, Field, inputCls } from '../components/ui'

export default function LoginPage() {
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