import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Flame, ShieldCheck, Smile, Sparkles, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import { useAppData } from '../contexts'
import { Card, SectionHeader, Gauge, Block } from '../components/ui'
import { ConfidenceBadge } from '../components/ConfidenceBadge'
import { fmt } from '../utils'
import { classifyTrade, buildNovaRankings, CONFIDENCE_THRESHOLDS } from '../calculations'
import type { NovaRankItem } from '../calculations'
import { useNovaInsights } from '../lib/useNovaInsights'
import type { CorrelationGroup, NovaMessage } from '../lib/useNovaInsights'

/* ==================== AJUSTES DEL PANEL ==================== */
const INITIAL_DISCIPLINE_DAYS = 5 // por debajo, la disciplina se muestra como "datos iniciales"

const STREAK_ORDER = ['Sin racha previa', 'Tras 1 pérdida', 'Tras 2 seguidas', 'Tras 3+ seguidas']

const EYEBROW = 'font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-900/40 dark:text-bone-100/40'
const HAIR = 'border-black/5 dark:border-ink-600'

/* ==================== HELPERS ==================== */
const signed = (n: number) => `${n > 0 ? '+' : ''}${fmt(n)}`

function formatShortDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function itemDetail(i: NovaRankItem) {
  return i.winRate === undefined
    ? `${i.sampleSize} trades · media ${fmt(i.avgPnl)}`
    : `${i.sampleSize} trades · WR ${i.winRate}% · media ${fmt(i.avgPnl)}`
}

/* ==================== COMPONENTES PEQUEÑOS ==================== */
function CardTitle({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-accent" />
        <h3 className="text-xl font-bold tracking-tight">{title}</h3>
      </div>
      {subtitle && <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mt-1">{subtitle}</p>}
    </div>
  )
}

function BriefingCard({ message, tradesNow }: { message: NovaMessage | null; tradesNow: number }) {
  const todayKey = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD
  const isToday = message?.dateKey === todayKey
  const newTrades = message ? Math.max(0, tradesNow - message.tradesCount) : 0

  return (
    <Card className="xl:col-span-2 p-6 flex flex-col relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 hidden dark:block bg-[radial-gradient(ellipse_at_top_right,rgba(245,165,36,0.10),transparent_60%)]" />
      <div className="relative flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-accent" />
          <p className={EYEBROW}>
            Nova · {isToday ? 'Briefing de hoy' : 'Último briefing'}
          </p>
        </div>

        {message ? (
          <>
            <p className="text-base md:text-lg font-medium leading-relaxed tracking-tight flex-1">{message.text}</p>
            <div className={`mt-5 pt-4 border-t ${HAIR}`}>
              <p className="text-xs text-ink-900/40 dark:text-bone-100/40">
                {formatShortDate(message.dateKey)} · basado en {message.tradesCount} operaciones
              </p>
              {newTrades > 0 && (
                <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mt-1">
                  Desde entonces has registrado {newTrades} {newTrades === 1 ? 'operación nueva' : 'operaciones nuevas'}.
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-900/40 dark:text-bone-100/40">
            El briefing de hoy aparecerá tras el próximo cálculo.
          </p>
        )}
      </div>
    </Card>
  )
}

function RankRow({ item }: { item: NovaRankItem }) {
  const tone = item.value >= 0 ? 'text-profit' : 'text-loss'
  return (
    <div className={`flex items-center justify-between gap-3 py-3 border-b ${HAIR} last:border-0`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium">{item.label}</p>
          {item.tag && (
            <span className="font-mono text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-black/5 dark:bg-ink-700 text-ink-900/50 dark:text-bone-100/50">
              {item.tag}
            </span>
          )}
        </div>
        <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mt-0.5">{itemDetail(item)}</p>
      </div>
      <div className="text-right shrink-0 space-y-1">
        <p className={`font-semibold tabular-nums ${tone}`}>{signed(item.value)}</p>
        <ConfidenceBadge level={item.level} />
      </div>
    </div>
  )
}

function RankingCard({
  icon, title, subtitle, items, emptyText,
}: { icon: any; title: string; subtitle: string; items: NovaRankItem[]; emptyText: string }) {
  return (
    <Card className="p-6">
      <CardTitle icon={icon} title={title} subtitle={subtitle} />
      {items.length === 0 ? (
        <p className="text-sm text-ink-900/40 dark:text-bone-100/40">{emptyText}</p>
      ) : (
        <div>{items.map(i => <RankRow key={i.key} item={i} />)}</div>
      )}
    </Card>
  )
}

function StreakRow({ label, group }: { label: string; group?: CorrelationGroup }) {
  const level = group?.confidenceLevel ?? 0
  const n = group?.sampleSize ?? 0
  const isBase = label === STREAK_ORDER[0]
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium">{label}</p>
          {isBase && <span className="text-[10px] text-ink-900/40 dark:text-bone-100/40">base de comparación</span>}
        </div>
        <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mt-0.5">
          {level === 0 || !group
            ? `${n} trades · sin datos suficientes`
            : `${n} trades · WR ${group.winRate}% · media ${fmt(group.avgPnl)}`}
        </p>
      </div>
      <ConfidenceBadge level={level} />
    </div>
  )
}

/* ==================== PÁGINA ==================== */
export default function NovaPanelPage() {
  const { insights, message, loading, error } = useNovaInsights()
  const { trades, settings, mindsetEntries } = useAppData()

  // Rankings: misma función que usa el servidor para el mensaje de Nova
  const rankings = useMemo(
    () =>
      insights
        ? buildNovaRankings(
            {
              dayOfWeek: insights.dayOfWeek,
              session: insights.session,
              strategy: insights.strategy,
              emotion: insights.emotion,
            },
            insights.byHour
          )
        : null,
    [insights]
  )
  const worst = rankings?.worst ?? []
  const best = rankings?.best ?? []
  const bestHours = rankings?.bestHours ?? []
  const worstHours = rankings?.worstHours ?? []

  // Racha de pérdidas en vivo (misma regla que usa el servidor)
  const currentLossStreak = useMemo(() => {
    const sorted = [...trades].sort(
      (a, b) => new Date(b.entry_datetime).getTime() - new Date(a.entry_datetime).getTime()
    )
    let streak = 0
    for (const t of sorted) {
      if (classifyTrade(t, settings) === 'loss') streak++
      else break
    }
    return streak
  }, [trades, settings])

  // Racha "sin perder" en vivo: un breakeven NO la rompe, solo una pérdida la rompe
  const currentWinStreak = useMemo(() => {
    const sorted = [...trades].sort(
      (a, b) => new Date(b.entry_datetime).getTime() - new Date(a.entry_datetime).getTime()
    )
    let streak = 0
    for (const t of sorted) {
      if (classifyTrade(t, settings) !== 'loss') streak++
      else break
    }
    return streak
  }, [trades, settings])

  // Última emoción dominante registrada en Mindset
  const lastEmotion = useMemo(() => {
    const entry = [...mindsetEntries]
      .filter(m => m.dominant_emotion)
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    return entry ? { date: entry.date, emotion: entry.dominant_emotion as string } : null
  }, [mindsetEntries])

  if (loading) {
    return (
      <div>
        <SectionHeader eyebrow="Nova" title="Panel Nova" />
        <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Cargando insights...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <SectionHeader eyebrow="Nova" title="Panel Nova" />
        <Card className="p-6"><p className="text-sm text-loss">{error}</p></Card>
      </div>
    )
  }

  if (!insights) {
    return (
      <div>
        <SectionHeader eyebrow="Nova" title="Panel Nova" />
        <Card className="p-6">
          <p className="text-sm text-ink-900/60 dark:text-bone-100/60">
            Aún no hay insights generados. Ve a <Link to="/" className="text-accent hover:underline">Panel</Link> y
            pulsa «Actualizar insights Nova».
          </p>
        </Card>
      </div>
    )
  }

  const generated = insights.generatedAt
    ? new Date(insights.generatedAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
    : '—'

  const disc = insights.discipline?.summary ?? null
  const discBroken = insights.disciplineBrokenToPnl
  const showDiscBroken = !!discBroken && discBroken.deltaConfidence > 0 // regla 6

  // Línea de racha en vivo (separada de la tabla histórica, para no confundir las dos cosas)
  const liveStreakNode =
    trades.length === 0 ? (
      <p className="text-sm text-ink-900/40 dark:text-bone-100/40">Aún no hay operaciones.</p>
    ) : currentLossStreak > 0 ? (
      <div className="flex items-center gap-2 rounded-xl bg-loss/10 px-3 py-2.5">
        <TrendingDown size={16} className="text-loss shrink-0" />
        <p className="text-sm font-medium">
          Llevas <span className="font-semibold">{currentLossStreak}</span>{' '}
          {currentLossStreak === 1 ? 'pérdida seguida' : 'pérdidas seguidas'}.
        </p>
      </div>
    ) : (
      <div className="flex items-center gap-2 rounded-xl bg-accent/10 px-3 py-2.5">
        <Flame size={16} className="text-accent shrink-0" />
        <p className="text-sm font-medium">
          Vas <span className="font-semibold">{currentWinStreak}</span>{' '}
          {currentWinStreak === 1 ? 'operación seguida' : 'operaciones seguidas'} sin perder.
        </p>
      </div>
    )

  return (
    <div>
      <SectionHeader
        eyebrow="Nova"
        title="Panel Nova"
        subtitle={`Datos del último cálculo: ${generated}. Se recalcula cada noche a las 00:00.`}
      />

      {/* ===== PERFORMANCE SCORE + BRIEFING NOVA ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <Card className="p-6 flex flex-col items-center relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 hidden dark:block bg-[radial-gradient(ellipse_at_top_left,rgba(245,165,36,0.10),transparent_60%)]" />
          <div className="relative flex flex-col items-center w-full">
            <p className={`${EYEBROW} self-start mb-2`}>
              Performance Score
            </p>
            {insights.performanceScore === null ? (
              <p className="text-sm text-ink-900/40 dark:text-bone-100/40 py-8">Sin datos</p>
            ) : (
              <Gauge score={Math.round(insights.performanceScore)} size="lg" />
            )}
          </div>
        </Card>

        <BriefingCard message={message} tradesNow={trades.length} />
      </div>

      {/* ===== RANKINGS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <RankingCard
          icon={TrendingDown}
          title="Lo que más falla"
          subtitle="Coste en $ = media por trade × nº de trades (P&L neto)."
          items={worst}
          emptyText={`Ningún grupo con ${CONFIDENCE_THRESHOLDS.exploratory}+ operaciones tiene saldo negativo.`}
        />
        <RankingCard
          icon={TrendingUp}
          title="Lo que mejor funciona"
          subtitle="Aportación en $ = media por trade × nº de trades (P&L neto)."
          items={best}
          emptyText={`Ningún grupo con ${CONFIDENCE_THRESHOLDS.exploratory}+ operaciones tiene saldo positivo.`}
        />
      </div>

      {/* ===== ESTADO AHORA + HORAS ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <Card className="p-6">
          <CardTitle icon={Zap} title="Tu estado ahora" />
          <div className="space-y-8">
            <Block icon={Flame} title="Racha" first>
              <div className="mb-4">{liveStreakNode}</div>
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-900/35 dark:text-bone-100/35 mb-2">
                Histórico: qué pasa después de una racha de pérdidas
              </p>
              <div className="space-y-1">
                {STREAK_ORDER.map(label => (
                  <StreakRow
                    key={label}
                    label={label}
                    group={insights.postLossStreak.find(g => g.label === label)}
                  />
                ))}
              </div>
              <p className="text-[11px] text-ink-900/40 dark:text-bone-100/40 mt-3">
                Basado en tu historial completo del último cálculo. No incluye tu racha actual en vivo (arriba).
              </p>
            </Block>

            <Block icon={ShieldCheck} title="Disciplina">
              {!disc || disc.daysWithData === 0 ? (
                <p className="text-sm text-ink-900/40 dark:text-bone-100/40">
                  Aún no hay post-sesiones con «¿seguiste el plan?» registrado.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-2xl font-bold tracking-tight tabular-nums">
                        {disc.avgScore ?? '—'}<span className="text-sm font-normal text-ink-900/40 dark:text-bone-100/40"> / 100</span>
                      </p>
                      <p className="text-xs text-ink-900/40 dark:text-bone-100/40">
                        Media de {disc.daysWithData} {disc.daysWithData === 1 ? 'día registrado' : 'días registrados'} (histórico)
                      </p>
                    </div>
                    {disc.daysWithData < INITIAL_DISCIPLINE_DAYS && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                        Datos iniciales
                      </span>
                    )}
                  </div>
                  <p className="text-sm">
                    Días con disciplina rota: <span className="font-semibold">{disc.brokenDaysCount}</span>
                  </p>
                  {disc.streakAlertActive && (
                    <p className="text-sm text-loss">Alerta: hubo una racha de 3 o más días seguidos con disciplina rota.</p>
                  )}
                  {showDiscBroken && discBroken && (
                    <div className="rounded-lg bg-black/5 dark:bg-ink-700 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-medium">P&L medio por día</p>
                        <ConfidenceBadge level={discBroken.deltaConfidence} unit="días" />
                      </div>
                      <p className="text-xs text-ink-900/60 dark:text-bone-100/60 mt-1">
                        {discBroken.groups[0]?.label}: {fmt(discBroken.groups[0]?.avgPnl ?? 0)} ({discBroken.groups[0]?.sampleSize} días)
                        {' · '}
                        {discBroken.groups[1]?.label}: {fmt(discBroken.groups[1]?.avgPnl ?? 0)} ({discBroken.groups[1]?.sampleSize} días)
                      </p>
                    </div>
                  )}
                </div>
              )}
            </Block>

            <Block icon={Smile} title="Última emoción">
              {lastEmotion ? (
                <p className="text-sm">
                  <span className="font-semibold">{lastEmotion.emotion}</span>
                  <span className="text-ink-900/40 dark:text-bone-100/40"> · {formatShortDate(lastEmotion.date)}</span>
                </p>
              ) : (
                <p className="text-sm text-ink-900/40 dark:text-bone-100/40">
                  Aún no has registrado una emoción dominante en Mindset.
                </p>
              )}
            </Block>
          </div>
        </Card>

        <Card className="p-6">
          <CardTitle
            icon={Clock}
            title="Mejores horas"
            subtitle={`Hora de entrada, horario de Madrid. Solo franjas con ${CONFIDENCE_THRESHOLDS.exploratory}+ operaciones.`}
          />
          {insights.byHour === null ? (
            <p className="text-sm text-ink-900/40 dark:text-bone-100/40">
              Todavía no hay datos por hora. Pulsa «Actualizar insights Nova» en Panel para generarlos.
            </p>
          ) : (
            <div className="space-y-6">
              <div>
                <p className={`${EYEBROW} mb-1`}>
                  Mejores
                </p>
                {bestHours.length === 0 ? (
                  <p className="text-sm text-ink-900/40 dark:text-bone-100/40">
                    Ninguna franja con datos suficientes tiene saldo positivo.
                  </p>
                ) : (
                  bestHours.map(i => <RankRow key={i.key} item={i} />)
                )}
              </div>
              <div>
                <p className={`${EYEBROW} mb-1`}>
                  Peores
                </p>
                {worstHours.length === 0 ? (
                  <p className="text-sm text-ink-900/40 dark:text-bone-100/40">
                    Ninguna franja con datos suficientes tiene saldo negativo.
                  </p>
                ) : (
                  worstHours.map(i => <RankRow key={i.key} item={i} />)
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      <p className="text-xs text-ink-900/40 dark:text-bone-100/40">
        Los costes en $ no se pueden sumar entre tarjetas: un mismo trade puede estar en varios grupos a la vez
        (por ejemplo, un martes en sesión de Asia).
      </p>
    </div>
  )
}
