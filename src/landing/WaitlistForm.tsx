import { useState } from 'react'
import type { FormEvent } from 'react'
import { getApp } from 'firebase/app'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { ArrowRight, Check } from 'lucide-react'
import '../firebase'

type Status = 'idle' | 'sending' | 'done' | 'error'

export default function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (status === 'sending') return
    setStatus('sending')
    setMessage('')
    try {
      const join = httpsCallable<{ email: string; consent: boolean; website: string }, { ok: boolean }>(
        getFunctions(getApp(), 'europe-west1'),
        'joinWaitlist'
      )
      await join({ email: email.trim(), consent, website })
      setStatus('done')
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      const text = (err as { message?: string }).message
      setMessage(
        code === 'functions/invalid-argument' && text
          ? text
          : 'No se pudo enviar. Inténtalo de nuevo en unos minutos.'
      )
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-[#D4AF6A]/40 bg-[#212327] px-6 py-8 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D4AF6A] text-[#17130A]">
          <Check size={18} strokeWidth={3} />
        </span>
        <p className="text-sm text-[#F5F3EE]">Solicitud recibida. Te avisaremos cuando haya acceso a la beta.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="relative mx-auto w-full max-w-md space-y-4 text-left">
      <input
        type="text"
        name="website"
        value={website}
        onChange={e => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      <input
        type="email"
        required
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="tucorreo@ejemplo.com"
        className="w-full rounded-xl border border-[#34363C] bg-[#212327] px-4 py-3 text-sm text-[#F5F3EE] placeholder:text-[#BDB9B0]/60 focus:border-[#D4AF6A] focus:outline-none"
      />
      <label className="flex items-start gap-3 text-xs leading-relaxed text-[#BDB9B0]">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={e => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#D4AF6A]"
        />
        <span>Acepto que se guarde mi email para avisarme cuando haya acceso a la beta.</span>
      </label>
      {status === 'error' && <p className="text-xs text-[#EBD9A8]">{message}</p>}
      <button
        type="submit"
        disabled={status === 'sending'}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#D4AF6A] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#17130A] shadow-[0_0_30px_rgba(212,175,106,0.35)] transition hover:bg-[#EBD9A8] disabled:opacity-60"
      >
        {status === 'sending' ? 'Enviando...' : 'Pedir acceso'}
        {status !== 'sending' && <ArrowRight size={16} />}
      </button>
    </form>
  )
}
