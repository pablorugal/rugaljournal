import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useAuth } from '../contexts'
import { Card, Field, inputCls } from '../components/ui'

export default function LoginPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
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
    <div className="dark">
      <div className="app-bg relative flex min-h-screen items-center justify-center bg-ink-900 px-4 py-16">
        <Link
          to="/"
          className="absolute left-6 top-6 inline-flex items-center gap-2 text-sm font-medium text-bone-100/50 transition hover:text-bone-100"
        >
          <ArrowLeft size={16} />
          Volver
        </Link>

        <div className="relative w-full max-w-sm">
          <Link to="/" className="mb-8 flex flex-col items-center">
            <div className="tj-logo w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-light to-accent flex items-center justify-center shrink-0">
              <svg width="28" height="28" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 50 L36 24 L36 50" stroke="#17181B" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <line x1="22" y1="24" x2="50" y2="24" stroke="#17181B" strokeWidth="6" strokeLinecap="round" />
                <line x1="40" y1="50" x2="52" y2="38" stroke="#17181B" strokeWidth="6" strokeLinecap="round" />
                <line x1="46" y1="38" x2="52" y2="38" stroke="#17181B" strokeWidth="6" strokeLinecap="round" />
                <line x1="52" y1="38" x2="52" y2="44" stroke="#17181B" strokeWidth="6" strokeLinecap="round" />
              </svg>
            </div>
            <span className="mt-4 text-2xl font-bold tracking-tight text-bone-100">Tradelic</span>
            <span className="font-mono mt-1 text-[11px] uppercase tracking-[0.2em] text-bone-100/40">
              Diario de trading con IA
            </span>
          </Link>

          <Card className="p-6 md:p-8">
            <h1 className="serif text-xl font-semibold text-bone-100">
              {mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}
            </h1>
            <p className="mb-6 mt-1 text-sm text-bone-100/50">
              {mode === 'login' ? 'Accede a tu diario de trading.' : 'Regístrate para empezar a usar Tradelic.'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Email">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.com"
                  className={inputCls}
                />
              </Field>
              <Field label="Contraseña">
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls}
                />
              </Field>
              {error && <p className="text-xs text-loss">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white shadow-soft hover:bg-accent-light disabled:opacity-60"
              >
                {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-bone-100/50">
              {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
              <button
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
                className="font-semibold text-accent hover:text-accent-light"
              >
                {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
              </button>
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
