import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Brain, Moon, Download, AlertTriangle, CalendarDays } from 'lucide-react'
import { todayISO } from '../utils'
import { useAppData } from '../contexts'
import { Card, SectionHeader, PillTabs, Field, inputCls, Toggle, ToggleRow, RadioRow, EmotionSliderStyled } from '../components/ui'
import type { MindsetBias } from '../types'

export default function MindsetPage() {
  const { mindsetEntries, upsertMindsetEntry } = useAppData()
  const [tab, setTab] = useState('pre')
  const [savedMsg, setSavedMsg] = useState('')

  /* --- Premarket --- */
  const [date, setDate] = useState(todayISO())
  const [challengeDay, setChallengeDay] = useState(1)
  const [emotion, setEmotion] = useState(7)
  const [sleptWell, setSleptWell] = useState(false)
  const [emotionalBaggage, setEmotionalBaggage] = useState(false)
  const [marketStructure, setMarketStructure] = useState<'' | 'clear' | 'accumulation'>('')
  const [dailyBiasDirection, setDailyBiasDirection] = useState<'' | MindsetBias>('')
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

  /* --- Cargar datos existentes al cambiar de fecha (Premarket) --- */
  useEffect(() => {
    const existing = mindsetEntries.find(e => e.date === date)
    if (existing) {
      setChallengeDay(existing.challenge_day ?? 1)
      setEmotion(existing.emotion ?? 7)
      setSleptWell(existing.slept_well ?? false)
      setEmotionalBaggage(existing.emotional_baggage ?? false)
      setMarketStructure(existing.market_structure ?? '')
      setDailyBiasDirection(existing.daily_bias ?? '')
      setHighImpactNews(existing.high_impact_news ?? false)
      setConviction(existing.conviction ?? false)
      setGoalToday(existing.goal_today ?? '')
      setPlanIfRed(existing.plan_if_red ?? '')
    } else {
      setChallengeDay(1); setEmotion(7); setSleptWell(false); setEmotionalBaggage(false)
      setMarketStructure(''); setDailyBiasDirection(''); setHighImpactNews(false)
      setConviction(false); setGoalToday(''); setPlanIfRed('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  /* --- Cargar datos existentes al cambiar de fecha (Post-sesión) --- */
  useEffect(() => {
    const existing = mindsetEntries.find(e => e.date === postDate)
    if (existing) {
      setPostChallengeDay(existing.challenge_day ?? 1)
      setCloseEmotion(existing.close_emotion ?? 5)
      setChangeVsStart(existing.change_vs_start ?? '')
      setStateBeforeFirstTrade(existing.state_before_first_trade ?? '')
      setNeededToRecover(existing.needed_to_recover ?? false)
      setWrongDecision(existing.wrong_decision ?? false)
      setDominantEmotion(existing.dominant_emotion ?? '')
      setEmotionInfluence(existing.emotion_influence ?? '')
      setFollowedPlan(existing.followed_plan ?? '')
      setTradedVersion(existing.traded_version ?? '')
      setEmotionalLearning(existing.emotional_learning ?? '')
      setTomorrowChange(existing.tomorrow_change ?? '')
    } else {
      setPostChallengeDay(1); setCloseEmotion(5); setChangeVsStart(''); setStateBeforeFirstTrade('')
      setNeededToRecover(false); setWrongDecision(false); setDominantEmotion(''); setEmotionInfluence('')
      setFollowedPlan(''); setTradedVersion(''); setEmotionalLearning(''); setTomorrowChange('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postDate])

  const flashSaved = (msg: string) => {
    setSavedMsg(msg)
    setTimeout(() => setSavedMsg(''), 2500)
  }

  const handleSavePremarket = () => {
    upsertMindsetEntry({
      date,
      challenge_day: challengeDay,
      emotion,
      slept_well: sleptWell,
      emotional_baggage: emotionalBaggage,
      market_structure: marketStructure,
      daily_bias: dailyBiasDirection,
      high_impact_news: highImpactNews,
      conviction,
      goal_today: goalToday,
      plan_if_red: planIfRed,
      has_premarket: true,
    })
    flashSaved('Premarket guardado correctamente ✔')
  }

  const handleSavePostSession = () => {
    upsertMindsetEntry({
      date: postDate,
      challenge_day: postChallengeDay,
      close_emotion: closeEmotion,
      change_vs_start: changeVsStart,
      state_before_first_trade: stateBeforeFirstTrade,
      needed_to_recover: neededToRecover,
      wrong_decision: wrongDecision,
      dominant_emotion: dominantEmotion,
      emotion_influence: emotionInfluence,
      followed_plan: followedPlan,
      traded_version: tradedVersion,
      emotional_learning: emotionalLearning,
      tomorrow_change: tomorrowChange,
      has_postsession: true,
    })
    flashSaved('Post-sesión guardada correctamente ✔')
  }

  return (
    <div>
      <SectionHeader eyebrow="Mindset" title="Mindset" subtitle="Disciplina mental: ritual premarket y revisión post-sesión."
        right={<button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium"><Download size={16} /> Exportar histórico</button>} />

      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <PillTabs tabs={[{ id: 'pre', label: 'Premarket' }, { id: 'post', label: 'Post-sesión' }]} active={tab} onChange={setTab} />
          <Link to="/mindset-calendar" className="flex items-center gap-2 px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">
            <CalendarDays size={16} /> Calendario
          </Link>
        </div>

        {tab === 'pre' ? (
          <Card className="p-6 md:p-8 space-y-8">
            <div>
              <h3 className="serif text-xl font-semibold flex items-center gap-2 mb-1"><Brain size={18} className="text-accent" /> Ritual Premarket</h3>
              <p className="text-xs text-ink-900/40 dark:text-bone-100/40">Antes de abrir la plataforma. Responde con honestidad.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Fecha"><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} /></Field>
              <Field label="Día del reto (1-30)"><input type="number" min={1} max={30} value={challengeDay} onChange={e => setChallengeDay(Number(e.target.value))} className={inputCls} /></Field>
            </div>

            <EmotionSliderStyled value={emotion} onChange={setEmotion} />

            <ToggleRow label="¿Más de 7 horas de sueño?" checked={sleptWell} onChange={setSleptWell} />
            <ToggleRow label="¿Arrastras carga emocional de días anteriores?" checked={emotionalBaggage} onChange={setEmotionalBaggage} />

            <div>
              <h3 className="text-base font-medium mb-3">Estado del mercado</h3>
              <div className="space-y-3">
                <RadioRow label="Tiene estructura clara" selected={marketStructure === 'clear'} onSelect={() => setMarketStructure('clear')} />
                <RadioRow label="Está en acumulación" selected={marketStructure === 'accumulation'} onSelect={() => setMarketStructure('accumulation')} />
              </div>
            </div>

            <div>
              <h3 className="text-base font-medium mb-3">Bias del día</h3>
              <div className="grid md:grid-cols-3 gap-3">
                <RadioRow label="Alcista" selected={dailyBiasDirection === 'Alcista'} onSelect={() => setDailyBiasDirection('Alcista')} />
                <RadioRow label="Bajista" selected={dailyBiasDirection === 'Bajista'} onSelect={() => setDailyBiasDirection('Bajista')} />
                <RadioRow label="Sin sesgo" selected={dailyBiasDirection === 'Sin sesgo'} onSelect={() => setDailyBiasDirection('Sin sesgo')} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">¿Hay noticias de alto impacto hoy?</span>
              <Toggle checked={highImpactNews} onChange={setHighImpactNews} />
            </div>

            <div>
              <p className="text-sm font-medium mb-6">¿Puedes afirmar con convicción que estás dispuesto a perder el máximo diario en el primer trade, sin que eso cambie tu comportamiento el resto del día?</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-900/60 dark:text-bone-100/60">{conviction ? 'Sí' : 'No'}</span>
                <Toggle checked={conviction} onChange={setConviction} />
              </div>
              {!conviction && (
                <div className="flex items-center gap-3 p-4 mt-4 rounded-xl bg-loss/10 border border-loss/20 text-loss text-sm font-medium">
                  <AlertTriangle size={18} className="shrink-0" />
                  Esta respuesta activa tu detonador. No operes hoy.
                </div>
              )}
            </div>

            <div>
              <h3 className="text-base font-medium mb-3">¿Qué quiero demostrarme hoy con mi forma de operar?</h3>
              <textarea rows={3} value={goalToday} onChange={e => setGoalToday(e.target.value)} placeholder="Habla del proceso, no del resultado." className={inputCls} />
            </div>

            <div>
              <h3 className="text-base font-medium mb-3">¿Cuál es mi plan si voy rojo desde el primer trade?</h3>
              <textarea rows={3} value={planIfRed} onChange={e => setPlanIfRed(e.target.value)} placeholder="Define tu límite antes de operar." className={inputCls} />
            </div>

            <div className="flex items-center gap-4">
              <button onClick={handleSavePremarket} className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light">
                Calcular señal y guardar
              </button>
              {savedMsg && <span className="text-sm font-medium text-profit">{savedMsg}</span>}
            </div>
          </Card>
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

            <div>
              <button onClick={handleSavePostSession} className="w-full px-6 py-3 rounded-lg bg-ink-900 dark:bg-bone-100 text-bone-50 dark:text-ink-900 text-sm font-semibold shadow-soft">
                Guardar post-sesión
              </button>
              {savedMsg && <p className="text-sm font-medium text-profit text-center mt-3">{savedMsg}</p>}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}