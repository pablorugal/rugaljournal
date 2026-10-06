import { Link } from 'react-router-dom'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import './landing.css'
import Reveal from './Reveal'
import BrowserFrame from './BrowserFrame'
import WaitlistForm from './WaitlistForm'

function goTo(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

const primaryBtn =
  'inline-flex items-center gap-2 rounded-full bg-[#D4AF6A] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#17130A] shadow-[0_0_30px_rgba(212,175,106,0.35)] transition hover:bg-[#EBD9A8]'
const secondaryBtn =
  'inline-flex items-center gap-2 rounded-full border border-[#34363C] bg-[#212327] px-6 py-3 text-sm font-semibold text-[#F5F3EE] transition hover:border-[#D4AF6A]/60'
const navBtn = 'transition hover:text-[#F5F3EE]'
const eyebrowCls = 'landing-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#D4AF6A]'

type FeatureProps = {
  id?: string
  eyebrow: string
  title: string
  text: string
  bullets?: string[]
  frameLabel: string
  reverse?: boolean
}

function Feature({ id, eyebrow, title, text, bullets, frameLabel, reverse }: FeatureProps) {
  return (
    <section id={id} className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16 md:py-24">
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
        <Reveal className={reverse ? 'md:order-2' : ''}>
          <p className={eyebrowCls}>{eyebrow}</p>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">{title}</h2>
          <p className="mt-5 text-base leading-relaxed text-[#BDB9B0]">{text}</p>
          {bullets && (
            <ul className="mt-6 space-y-3">
              {bullets.map(b => (
                <li key={b} className="flex items-start gap-3 text-sm text-[#F5F3EE]">
                  <Check size={16} className="mt-0.5 shrink-0 text-[#D4AF6A]" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </Reveal>
        <Reveal delay={150} className={reverse ? 'md:order-1' : ''}>
          <BrowserFrame label={frameLabel} />
        </Reveal>
      </div>
    </section>
  )
}

const LEVELS = [
  { name: 'Exploratoria', range: '5-19 operaciones', text: 'Patrón inicial — basado en pocas operaciones. Tómalo como orientación.', bars: 1 },
  { name: 'Emergente', range: '20-49 operaciones', text: 'Patrón emergente — ganando consistencia.', bars: 2 },
  { name: 'Consolidada', range: '50 o más operaciones', text: 'Patrón consolidado — muestra suficiente para confiar en esta tendencia.', bars: 3 },
]

export default function LandingPage() {
  return (
    <div className="landing min-h-screen">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#34363C]/70 bg-[#17181B]/75 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <button onClick={() => goTo('inicio')} className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D4AF6A] text-base font-extrabold text-[#17130A]">T</span>
            <span className="text-lg font-extrabold tracking-tight">
              Tu<span className="text-[#D4AF6A]">Journal</span>
            </span>
          </button>
          <nav className="hidden items-center gap-8 text-sm font-medium text-[#BDB9B0] md:flex">
            <button onClick={() => goTo('inicio')} className={navBtn}>Inicio</button>
            <button onClick={() => goTo('funciones')} className={navBtn}>Funciones</button>
            <button onClick={() => goTo('nova')} className={navBtn}>Nova</button>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="px-3 py-2 text-sm font-medium text-[#BDB9B0] transition hover:text-[#F5F3EE]">
              Entrar
            </Link>
            <button
              onClick={() => goTo('acceso')}
              className="rounded-full bg-[#D4AF6A] px-5 py-2 text-sm font-bold text-[#17130A] transition hover:bg-[#EBD9A8]"
            >
              Pedir acceso
            </button>
          </div>
        </div>
      </header>

      <section id="inicio" className="relative px-6 pb-16 pt-36 text-center md:pt-44">
        <div className="landing-glow pointer-events-none absolute left-1/2 top-24 h-[420px] w-[820px] max-w-full -translate-x-1/2" />
        <div className="relative mx-auto max-w-5xl">
          <span className="landing-mono inline-flex items-center gap-2 rounded-full border border-[#34363C] bg-[#212327] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF6A]">
            <Sparkles size={14} />
            Diario de trading con IA
          </span>
          <h1 className="mt-8 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Tus operaciones, explicadas.
            <br />
            <span className="l-gradient">Tus errores, con cifras.</span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-[#BDB9B0] md:text-lg">
            El diario de trading con IA que detecta patrones en tu conducta, calcula cuánto te cuestan y te dice con
            honestidad cuántos datos hay detrás.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button onClick={() => goTo('acceso')} className={primaryBtn}>
              Pedir acceso <ArrowRight size={16} />
            </button>
            <button onClick={() => goTo('funciones')} className={secondaryBtn}>
              Ver cómo funciona <ArrowRight size={16} />
            </button>
          </div>
        </div>
        <div className="relative mx-auto mt-16 max-w-5xl">
          <BrowserFrame label="Panel Nova" />
        </div>
      </section>

      <Feature
        id="funciones"
        eyebrow="Performance Score"
        title="Una nota que resume cómo estás operando"
        text="Un solo número para ver de un vistazo si tu operativa mejora o empeora, con el detalle de lo que lo mueve."
        frameLabel="Performance Score"
      />

      <Feature
        eyebrow="Lo que falla y lo que funciona"
        title="Descubre qué te cuesta dinero"
        text="Nova cruza tus operaciones por día de la semana, sesión, instrumento y estado emocional, y te muestra cuánto te resta o te suma cada uno, en dinero real."
        bullets={[
          'Ranking de lo que más te resta',
          'Ranking de lo que más te suma',
          'Cada patrón con su nivel de confianza',
        ]}
        frameLabel="Lo que más falla"
        reverse
      />

      <Feature
        eyebrow="Disciplina"
        title="Tu disciplina, día a día"
        text="Una puntuación diaria con el histórico de los últimos 90 días, para ver si cumples tus propias reglas y, cuando hay datos suficientes, qué te cuesta romperlas."
        frameLabel="Disciplina"
      />

      <Feature
        eyebrow="Mejores horas"
        title="Descubre a qué hora operas mejor"
        text="Tu resultado neto según la hora de entrada: las horas que más te suman y las que más te restan."
        frameLabel="Mejores horas"
        reverse
      />

      <section id="nova" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16 md:py-24">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className={eyebrowCls}>Niveles de confianza</p>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
            Nova te dice cuántos datos hay detrás de cada patrón
          </h2>
          <p className="mt-5 text-base leading-relaxed text-[#BDB9B0]">
            Con pocas operaciones, casi todo es ruido. Por eso cada patrón lleva su nivel de confianza y Nova no exagera
            con muestras pequeñas.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {LEVELS.map((lvl, i) => (
            <Reveal key={lvl.name} delay={i * 120}>
              <div className="h-full rounded-2xl border border-[#34363C] bg-[#212327] p-6">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(n => (
                    <span key={n} className={`h-1.5 w-8 rounded-full ${n < lvl.bars ? 'bg-[#D4AF6A]' : 'bg-[#34363C]'}`} />
                  ))}
                </div>
                <h3 className="mt-5 text-xl font-bold">{lvl.name}</h3>
                <p className="landing-mono mt-1 text-xs text-[#BDB9B0]">{lvl.range}</p>
                <p className="mt-4 text-sm leading-relaxed text-[#BDB9B0]">{lvl.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <p className="mt-8 text-center text-sm text-[#BDB9B0]">Con menos de 5 operaciones, Nova no detecta patrones.</p>
        </Reveal>
      </section>

      <Feature
        eyebrow="Chat con Nova"
        title="Pregúntale a Nova por tus operaciones"
        text="Habla con la IA sobre tu operativa, también con capturas de pantalla."
        frameLabel="Chat con Nova"
      />

      <section id="acceso" className="relative scroll-mt-20 px-6 py-20 text-center md:py-28">
        <div className="landing-glow pointer-events-none absolute left-1/2 top-10 h-[360px] w-[760px] max-w-full -translate-x-1/2" />
        <Reveal className="relative mx-auto max-w-2xl">
          <p className={eyebrowCls}>Beta</p>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">Pide acceso a la beta</h2>
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-[#BDB9B0]">
            Estamos abriendo el acceso poco a poco. Déjanos tu email y te avisaremos.
          </p>
          <div className="mt-10">
            <WaitlistForm />
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-[#34363C] px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-[#BDB9B0] md:flex-row">
          <span>© {new Date().getFullYear()} TuJournal</span>
          <span>Nova analiza tus datos de trading; no ofrece asesoramiento de inversión.</span>
        </div>
      </footer>
    </div>
  )
}
