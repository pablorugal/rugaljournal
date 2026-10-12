import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Square, RotateCcw } from 'lucide-react'

/* ========= Configuración del ritual (ajustable) ========= */
const INHALE_S = 4
const HOLD1_S = 4
const EXHALE_S = 4
const HOLD2_S = 4
const CYCLES = 12
const MEDITATION_S = 5 * 60

type SegType = 'inhale' | 'hold1' | 'exhale' | 'hold2' | 'meditation'
interface Segment { type: SegType; duration: number; cycle: number }
interface AmbientNodes { osc1: OscillatorNode; osc2: OscillatorNode; lfo: OscillatorNode; gain: GainNode }

function buildTimeline() {
  const segments: Segment[] = []
  for (let i = 0; i < CYCLES; i++) {
    segments.push({ type: 'inhale', duration: INHALE_S, cycle: i + 1 })
    segments.push({ type: 'hold1', duration: HOLD1_S, cycle: i + 1 })
    segments.push({ type: 'exhale', duration: EXHALE_S, cycle: i + 1 })
    segments.push({ type: 'hold2', duration: HOLD2_S, cycle: i + 1 })
  }
  segments.push({ type: 'meditation', duration: MEDITATION_S, cycle: CYCLES })
  const starts: number[] = []
  let acc = 0
  for (const seg of segments) { starts.push(acc); acc += seg.duration }
  return { segments, starts, total: acc }
}

function segmentIndexForElapsed(elapsed: number, starts: number[]) {
  for (let i = starts.length - 1; i >= 0; i--) {
    if (elapsed >= starts[i]) return i
  }
  return 0
}

function formatMMSS(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

function labelForType(type: SegType): string {
  switch (type) {
    case 'inhale': return 'Inhala'
    case 'hold1': return 'Mantén'
    case 'exhale': return 'Exhala'
    case 'hold2': return 'Mantén'
    case 'meditation': return 'Respira con calma'
    default: return ''
  }
}

function scaleForType(type: SegType): number {
  if (type === 'inhale' || type === 'hold1') return 1.15
  if (type === 'exhale' || type === 'hold2') return 0.85
  return 1
}

/* ========= Motor de audio (síntesis, sin archivos externos) ========= */
function ensureAudioContext(ref: { current: AudioContext | null }): AudioContext {
  if (!ref.current) {
    const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext
    ref.current = new Ctor()
  }
  return ref.current
}

function playTone(ctx: AudioContext, freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.12) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  const now = ctx.currentTime
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(volume, now + 0.08)
  gain.gain.linearRampToValueAtTime(0, now + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + duration + 0.05)
}

function playCue(ctx: AudioContext, type: SegType) {
  if (type === 'inhale') playTone(ctx, 392, 0.55, 'sine', 0.11)
  else if (type === 'exhale') playTone(ctx, 294, 0.55, 'sine', 0.11)
  else playTone(ctx, 523, 0.28, 'sine', 0.08)
}

function startAmbient(ctx: AudioContext, ref: { current: AmbientNodes | null }) {
  if (ref.current) return
  const osc1 = ctx.createOscillator()
  const osc2 = ctx.createOscillator()
  osc1.type = 'sine'; osc1.frequency.value = 110
  osc2.type = 'sine'; osc2.frequency.value = 164.81
  const gain = ctx.createGain()
  const now = ctx.currentTime
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.045, now + 2)
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.06
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 0.015
  lfo.connect(lfoGain)
  lfoGain.connect(gain.gain)
  osc1.connect(gain)
  osc2.connect(gain)
  gain.connect(ctx.destination)
  osc1.start(now); osc2.start(now); lfo.start(now)
  ref.current = { osc1, osc2, lfo, gain }
}

function stopAmbient(ref: { current: AmbientNodes | null }, fadeSeconds = 1.2) {
  const nodes = ref.current
  if (!nodes) return
  const ctx = nodes.gain.context
  const now = ctx.currentTime
  nodes.gain.gain.cancelScheduledValues(now)
  nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, now)
  nodes.gain.gain.linearRampToValueAtTime(0, now + fadeSeconds)
  nodes.osc1.stop(now + fadeSeconds + 0.1)
  nodes.osc2.stop(now + fadeSeconds + 0.1)
  nodes.lfo.stop(now + fadeSeconds + 0.1)
  ref.current = null
}

/* ========= Página ========= */
export default function RitualPage() {
  const { segments, starts, total } = useMemo(() => buildTimeline(), [])
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [segIndex, setSegIndex] = useState(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const ambientRef = useRef<AmbientNodes | null>(null)
  const segmentIndexRef = useRef(-1)

  useEffect(() => {
    return () => {
      stopAmbient(ambientRef, 0.1)
      audioCtxRef.current?.close().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (phase !== 'running') return
    const id = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (phase !== 'running' || elapsed === 0) return
    if (elapsed >= total) {
      stopAmbient(ambientRef)
      const ctx = ensureAudioContext(audioCtxRef)
      playTone(ctx, 660, 1.2, 'sine', 0.15)
      setPhase('done')
      return
    }
    const idx = segmentIndexForElapsed(elapsed, starts)
    if (idx !== segmentIndexRef.current) {
      segmentIndexRef.current = idx
      setSegIndex(idx)
      const seg = segments[idx]
      const ctx = ensureAudioContext(audioCtxRef)
      if (seg.type === 'meditation') {
        stopAmbient(ambientRef)
        playTone(ctx, 220, 1.6, 'sine', 0.16)
      } else {
        playCue(ctx, seg.type)
      }
    }
  }, [elapsed, phase, segments, starts, total])

  const handleStart = () => {
    const ctx = ensureAudioContext(audioCtxRef)
    if (ctx.state === 'suspended') void ctx.resume()
    startAmbient(ctx, ambientRef)
    segmentIndexRef.current = 0
    setSegIndex(0)
    playCue(ctx, segments[0].type)
    setElapsed(0)
    setPhase('running')
  }

  const handleStop = () => {
    stopAmbient(ambientRef)
    setPhase('idle')
    setElapsed(0)
    segmentIndexRef.current = -1
    setSegIndex(0)
  }

  const currentSeg = phase === 'running' ? segments[segIndex] : null

  let stepLabel = 'LISTO PARA EMPEZAR'
  let pct = 0
  if (phase === 'running' && currentSeg) {
    pct = Math.min(100, Math.round((elapsed / total) * 100))
    if (currentSeg.type === 'meditation') {
      const remaining = starts[segIndex] + currentSeg.duration - elapsed
      stepLabel = `MEDITACIÓN · ${formatMMSS(remaining)} RESTANTE`
    } else {
      stepLabel = `CICLO ${currentSeg.cycle}/${CYCLES} · ${labelForType(currentSeg.type).toUpperCase()}`
    }
  } else if (phase === 'done') {
    pct = 100
    stepLabel = 'COMPLETADO'
  }

  const circleText = phase === 'running' && currentSeg ? labelForType(currentSeg.type) : phase === 'done' ? 'HECHO' : 'LISTO'
  const circleScale = phase === 'running' && currentSeg ? scaleForType(currentSeg.type) : 1

  let description = 'Respiración guiada 4-4-4-4 durante 12 ciclos con un sonido ambiental suave, seguida de 5 minutos de meditación en silencio. Duración total: ~8 minutos.'
  if (phase === 'running' && currentSeg) {
    description = currentSeg.type === 'meditation'
      ? 'Cierra los ojos. Te avisaremos con un sonido cuando termine.'
      : 'Sigue el ritmo de la respiración. El sonido te guía.'
  } else if (phase === 'done') {
    description = 'Ritual completado. Buena sesión de trading.'
  }

  return (
    <div className="fixed inset-0 lg:relative lg:inset-auto bg-ink-900 text-bone-100 -m-6 md:-m-8 min-h-screen flex flex-col items-center justify-center p-8">
      <span className="text-[11px] font-semibold tracking-widest uppercase bg-white/10 px-3 py-1 rounded-full mb-6">Ritual Pre-sesión</span>
      <h1 className="serif text-5xl font-semibold mb-3">RITUAL</h1>
      <p className="text-sm text-bone-100/50 max-w-md text-center mb-12">{description}</p>
      <div className="relative w-56 h-56 flex items-center justify-center mb-10">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-accent/40 to-black/10 blur-2xl" />
        <div
          className="relative w-40 h-40 rounded-full border border-white/10 flex items-center justify-center transition-transform ease-in-out"
          style={{ transform: `scale(${circleScale})`, transitionDuration: '4000ms' }}
        >
          <span className="text-sm tracking-widest font-medium uppercase text-center px-2">{circleText}</span>
        </div>
      </div>
      <div className="w-full max-w-xs mb-8">
        <div className="flex justify-between text-xs text-bone-100/40 mb-2"><span>{stepLabel}</span><span>{pct}%</span></div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${pct}%` }} /></div>
      </div>
      {phase === 'idle' && (
        <button onClick={handleStart} className="flex items-center gap-2 px-8 py-3 rounded-full bg-accent text-white font-semibold shadow-glow">
          <Play size={16} /> Comenzar RITUAL
        </button>
      )}
      {phase === 'running' && (
        <button onClick={handleStop} className="flex items-center gap-2 px-8 py-3 rounded-full border border-white/20 text-bone-100 font-semibold hover:bg-white/5 transition">
          <Square size={16} /> Detener
        </button>
      )}
      {phase === 'done' && (
        <button onClick={handleStart} className="flex items-center gap-2 px-8 py-3 rounded-full bg-accent text-white font-semibold shadow-glow">
          <RotateCcw size={16} /> Repetir
        </button>
      )}
    </div>
  )
}
