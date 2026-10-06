import React, { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { Card, StatusPill } from './ui'
import { SESSIONS, OUT_OF_SESSION_LABEL, getSession } from '../calculations'

const NAMED_ZONES = [
  { key: 'Europe/Madrid', label: 'Madrid' },
  { key: 'Europe/London', label: 'Londres' },
  { key: 'America/New_York', label: 'Nueva York' },
  { key: 'Asia/Tokyo', label: 'Tokio' },
] as const

// Boundaries ordenados: hora en la que EMPIEZA cada sesión (incluye "fuera de sesión" a las 22h)
const BOUNDARIES = [
  ...SESSIONS.map((s) => ({ from: s.from, label: s.label as string })),
  { from: 22, label: OUT_OF_SESSION_LABEL },
].sort((a, b) => a.from - b.from)

function formatTimeInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function getMadridHourMinute(date: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    hourCycle: 'h23',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(date)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return { hour, minute }
}

function shortName(label: string): string {
  return label.split(' (')[0]
}

export function SessionClock() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const { hour, minute } = getMadridHourMinute(now)
  const sessionLabel = getSession(hour)
  const isLive = sessionLabel !== OUT_OF_SESSION_LABEL
  const nowMinutes = hour * 60 + minute

  const next = BOUNDARIES.find((b) => b.from * 60 > nowMinutes) ?? BOUNDARIES[0]
  let diffMinutes = next.from * 60 - nowMinutes
  if (diffMinutes <= 0) diffMinutes += 24 * 60
  const diffH = Math.floor(diffMinutes / 60)
  const diffM = diffMinutes % 60

  return (
    <div className="flex justify-end mb-6">
      <Card className="inline-flex items-stretch divide-x divide-black/5 dark:divide-white/10 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <StatusPill live={isLive} />
          <div className="flex flex-col leading-tight">
            <span className="text-[9px] font-mono uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">
              {shortName(sessionLabel)}
            </span>
            <span className="text-xs font-semibold tabular-nums">
              Próxima: {shortName(next.label)} en {diffH}h {diffM}m
            </span>
          </div>
        </div>
        {NAMED_ZONES.map((z) => (
          <div key={z.key} className="flex items-center gap-2 px-4 py-2.5">
            <Clock size={13} className="text-accent shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] font-mono uppercase tracking-wide text-ink-900/40 dark:text-bone-100/40">
                {z.label}
              </span>
              <span className="text-sm font-bold tabular-nums">{formatTimeInZone(now, z.key)}</span>
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}
