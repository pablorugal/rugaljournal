import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useAuth } from '../contexts'
import '../landing/landing.css'

const fieldCls =
  'l-input w-full rounded-xl border border-[#2A2620] bg-[#0B0A08] px-4 py-3 text-sm text-[#F5F1E8] placeholder:text-[#A8A196]/60 focus:border-[#F5A524] focus:outline-none'
const labelCls = 'mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-[#A8A196]'

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
    <div className="landing relative flex min-h-screen items-center justify-center px-4 py-16">
      <div className="landing-glow pointer-events-none absolute left-1/2 top-1/4 h-[420px] w-[820px] max-w-full -translate-x-1/2" />

      <Link
        to="/"
        className="absolute left-6 top-6 inline-flex items-center gap-2 text-sm font-medium text-[#A8A196] transition hover:text-[#F5F1E8]"
      >
        <ArrowLeft size={16} />
        Volver
      </Link>

      <div className="relative w-full max-w-sm">
        <Link to="/" className="mb-8 flex flex-col items-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F5A524] text-2xl font-extrabold text-[#0B0A08]">
            T
          </span>
          <span className="mt-3 text-2xl font-extrabold tracking-tight">
            Tu<span className="text-[#F5A524]">Journal</span>
          </span>
          <span className="landing-mono mt-1 text-[11px] uppercase tracking-[0.2em] text-[#A8A196]">
            Diario de trading con IA
          </span>
        </Link>

        <div className="rounded-2xl border border-[#2A2620] bg-[#14120F] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)] md:p-8">
          <h1 className="text-xl font-extrabold tracking-tight">
            {mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}
          </h1>
          <p className="mb-6 mt-1 text-sm text-[#A8A196]">
            {mode === 'login' ? 'Accede a tu diario de trading.' : 'Regístrate para empezar a usar TuJournal.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className={labelCls}>Email</label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
                className={fieldCls}
              />
            </div>
            <div>
              <label htmlFor="login-password" className={labelCls}>Contraseña</label>
              <input
                id="login-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className={fieldCls}
              />
            </div>
            {error && <p className="text-xs text-[#FFD27A]">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#F5A524] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#0B0A08] shadow-[0_0_30px_rgba(245,165,36,0.35)] transition hover:bg-[#FFD27A] disabled:opacity-60"
            >
              {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-[#A8A196]">
            {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
              className="font-semibold text-[#F5A524] transition hover:text-[#FFD27A]"
            >
              {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
