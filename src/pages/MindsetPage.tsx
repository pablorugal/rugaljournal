import { useState } from 'react'
import { Brain, Moon, Download } from 'lucide-react'
import { todayISO } from '../utils'
import { Card, SectionHeader, PillTabs, Field, inputCls, Toggle, ToggleRow, RadioRow, EmotionSliderStyled } from '../components/ui'

export default function MindsetPage() {
  const [tab, setTab] = useState('pre')

  /* --- Premarket --- */
  const [date, setDate] = useState(todayISO())
  const [challengeDay, setChallengeDay] = useState(1)
  const [emotion, setEmotion] = useState(7)
  const [sleptWell, setSleptWell] = useState(false)
  const [emotionalBaggage, setEmotionalBaggage] = useState(false)
  const [marketStructure, setMarketStructure] = useState<'' | 'clear' | 'accumulation'>('')
  const [highImpactNews, setHighImpactNews] = useState(false)
  const [conviction, setConviction] = useState(false)
  const [goalToday, setGoalToday] = useState('')
  const [planIfRed, setPlanIfRed] = useState('')

  /* --- Post-sesión --- */
  const [postDate, setPostDate] = useState(todayISO())
  const [postChallengeDay, setPostChallengeDay] = useState(1)
  const [closeEmotion, setCloseEmotion] = useState(5)
  const [changeVsStart, setChangeVsStart] = useState<'' | 'mejor' | 'igual' | 'peor'>('')
  const [stateBeforeFirstTrade, setStateBeforeFirstTrade] = useState('')
  const [neededToRecover, setNeededToRecover] = useState(false)
  const [wrongDecision, setWrongDecision] = useState(false)
  const [dominantEmotion, setDominantEmotion] = useState('')
  const [emotionInfluence, setEmotionInfluence] = useState('')
  const [followedPlan, setFollowedPlan] = useState<'' | 'yes' | 'partial' | 'no'>('')
  const [tradedVersion, setTradedVersion] = useState('')
  const [emotionalLearning, setEmotionalLearning] = useState('')
  const [tomorrowChange, setTomorrowChange] = useState('')

  return (
    <div>
      <SectionHeader eyebrow="Mindset" title="Mindset" subtitle="Disciplina mental: ritual premarket y revisión post-sesión."
        right={<button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium"><Download size={16} /> Exportar histórico</button>} />
      <div className="mb-6"><PillTabs tabs={[{ id: 'pre', label: 'Premarket' }, { id: 'post', label: 'Post-sesión' }]} active={tab} onChange={setTab} /></div>

      {tab === 'pre' ? (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="serif text-xl font-semibold flex items-center gap-2 mb-1"><Brain size={18} className="text-accent" /> Ritual Premarket</h3>
            <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mb-6">Antes de abrir la plataforma. Responde con honestidad.</p>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Fecha"><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} /></Field>
              <Field label="Día del reto (1-30)"><input type="number" min={1} max={30} value={challengeDay} onChange={e => setChallengeDay(Number(e.target.value))} className={inputCls} /></Field>
            </div>
          </Card>

          <Card className="p-6">
            <EmotionSliderStyled value={emotion} onChange={setEmotion} />
          </Card>

          <ToggleRow label="¿Más de 7 horas de sueño?" checked={sleptWell} onChange={setSleptWell} />
          <ToggleRow label="¿Arrastras carga emocional de días anteriores?" checked={emotionalBaggage} onChange={setEmotionalBaggage} />

          <div>
            <h3 className="text-base font-medium mb-3">Estado del mercado</h3>
            <div className="space-y-3">
              <RadioRow label="Tiene estructura clara" selected={marketStructure === 'clear'} onSelect={() => setMarketStructure('clear')} />
              <RadioRow label="Está en acumulación" selected={marketStructure === 'accumulation'} onSelect={() => setMarketStructure('accumulation')} />
            </div>
          </div>

          <ToggleRow label="¿Hay noticias de alto impacto hoy?" checked={highImpactNews} onChange={setHighImpactNews} />

          <Card className="p-6">
            <p className="text-sm font-medium mb-6">¿Puedes afirmar con convicción que estás dispuesto a perder el máximo diario en el primer trade, sin que eso cambie tu comportamiento el resto del día?</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-900/60 dark:text-bone-100/60">Sí</span>
              <Toggle checked={conviction} onChange={setConviction} />
            </div>
          </Card>

          <div>
            <h3 className="text-base font-medium mb-3">¿Qué quiero demostrarme hoy con mi forma de operar?</h3>
            <textarea rows={3} value={goalToday} onChange={e => setGoalToday(e.target.value)} placeholder="Habla del proceso, no del resultado." className={inputCls} />
          </div>

          <div>
            <h3 className="text-base font-medium mb-3">¿Cuál es mi plan si voy rojo desde el primer trade?</h3>
            <textarea rows={3} value={planIfRed} onChange={e => setPlanIfRed(e.target.value)} placeholder="Define tu límite antes de operar." className={inputCls} />
          </div>

          <button className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft">Calcular señal y guardar</button>
        </div>
      ) : (
        <Card className="p-6 md:p-8 space-y-8">
          <div>
            <h3 className="serif text-xl font-semibold flex items-center gap-2 mb-1"><Moon size={18} className="text-accent" /> Post-sesión psicológica</h3>
            <p className="text-xs text-ink-900/40 dark:text-bone-100/40">Al cerrar la plataforma. Sé brutalmente honesto.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Fecha"><input type="date" value={postDate} onChange={e => setPostDate(e.target.value)} className={inputCls} /></Field>
            <Field label="Día del reto (1-30)"><input type="number" min={1} max={30} value={postChallengeDay} onChange={e => setPostChallengeDay(Number(e.target.value))} className={inputCls} /></Field>
          </div>

          <div>
            <p className="text-base font-medium mb-4">Estado emocional al cierre ({closeEmotion}/10)</p>
            <input type="range" min={1} max={10} value={closeEmotion} onChange={e => setCloseEmotion(Number(e.target.value))}
              className="w-full accent-ink-900 dark:accent-bone-100" />
          </div>

          <div>
            <h3 className="text-base font-medium mb-3">¿Cómo ha cambiado respecto al inicio?</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <RadioRow label="Mejor" selected={changeVsStart === 'mejor'} onSelect={() => setChangeVsStart('mejor')} />
              <RadioRow label="Igual" selected={changeVsStart === 'igual'} onSelect={() => setChangeVsStart('igual')} />
              <RadioRow label="Peor" selected={changeVsStart === 'peor'} onSelect={() => setChangeVsStart('peor')} />
            </div>
          </div>

          <div>
            <h3 className="text-base font-medium mb-3">¿Cómo estabas emocionalmente antes de entrar al primer trade?</h3>
            <textarea rows={3} value={stateBeforeFirstTrade} onChange={e => setStateBeforeFirstTrade(e.target.value)}
              placeholder="Describe el estado interno, no el setup. ¿Había urgencia? ¿Calma? ¿Ansiedad?" className={inputCls} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">¿Hubo algún momento en que sentiste que necesitabas recuperar?</span>
            <Toggle checked={neededToRecover} onChange={setNeededToRecover} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">¿Tomaste alguna decisión que sabías incorrecta en el momento?</span>
            <Toggle checked={wrongDecision} onChange={setWrongDecision} />
          </div>

          <div>
            <h3 className="text-base font-medium mb-3">Emoción dominante</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {['Frustración', 'Miedo a perder', 'Codicia', 'Aburrimiento', 'Impaciencia', 'Calma', 'Otra'].map(e => (
                <RadioRow key={e} label={e} selected={dominantEmotion === e} onSelect={() => setDominantEmotion(e)} />
              ))}
            </div>
            <textarea rows={3} value={emotionInfluence} onChange={e => setEmotionInfluence(e.target.value)}
              placeholder="¿Cómo influyó en tus decisiones?" className={inputCls} />
          </div>

          <div>
            <h3 className="text-base font-medium mb-3">¿Respetaste tu plan inicial del premarket?</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <RadioRow label="Sí completamente" selected={followedPlan === 'yes'} onSelect={() => setFollowedPlan('yes')} />
              <RadioRow label="Parcialmente" selected={followedPlan === 'partial'} onSelect={() => setFollowedPlan('partial')} />
              <RadioRow label="No" selected={followedPlan === 'no'} onSelect={() => setFollowedPlan('no')} />
            </div>
          </div>

          <div>
            <h3 className="text-base font-medium mb-3">¿Qué versión de ti operó hoy, la que entrena o la que reacciona?</h3>
            <textarea rows={3} value={tradedVersion} onChange={e => setTradedVersion(e.target.value)} className={inputCls} />
          </div>

          <div>
            <h3 className="text-base font-medium mb-3">Aprendizaje emocional del día (una sola frase)</h3>
            <input value={emotionalLearning} onChange={e => setEmotionalLearning(e.target.value)} className={inputCls} />
          </div>

          <div>
            <h3 className="text-base font-medium mb-3">Una cosa concreta que haré diferente mañana</h3>
            <textarea rows={3} value={tomorrowChange} onChange={e => setTomorrowChange(e.target.value)} className={inputCls} />
          </div>

          <button className="w-full px-6 py-3 rounded-lg bg-ink-900 dark:bg-bone-100 text-bone-50 dark:text-ink-900 text-sm font-semibold shadow-soft">
            Guardar post-sesión
          </button>
        </Card>
      )}
    </div>
  )
}