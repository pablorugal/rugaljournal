import {onSchedule} from "firebase-functions/v2/scheduler";
import {onCall} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {XMLParser} from "fast-xml-parser";

const FF_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.xml";

export interface EconomicEvent {
  id: string;
  title: string;
  country: string;
  impact: "High" | "Medium" | "Low" | "Holiday" | "Unknown";
  forecast: string | null;
  previous: string | null;
  url: string;
  dateTimeUTC: string | null;
  rawDate: string;
  rawTime: string;
}

interface RawFFEvent {
  title?: unknown;
  country?: unknown;
  date?: unknown;
  time?: unknown;
  impact?: unknown;
  forecast?: unknown;
  previous?: unknown;
  url?: unknown;
}

function ensureFirebaseApp(): void {
  if (getApps().length === 0) initializeApp();
}

function toText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";
  return String(value);
}

function parseDateMMDDYYYY(dateStr: string): {year: number; month: number; day: number} | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dateStr.trim());
  if (!match) return null;
  return {
    month: parseInt(match[1], 10),
    day: parseInt(match[2], 10),
    year: parseInt(match[3], 10),
  };
}

function parseTimeTo24h(timeStr: string): {hour: number; minute: number} | null {
  const match = /^(\d{1,2}):(\d{2})(am|pm)$/i.exec(timeStr.trim());
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const meridiem = match[3].toLowerCase();
  if (hour === 12) hour = 0;
  if (meridiem === "pm") hour += 12;
  return {hour, minute};
}

/**
 * El feed de Forex Factory publica <date>+<time> directamente en UTC.
 * Confirmado comparando eventos de hora fija conocida (ej. Unemployment Claims,
 * ISM Services PMI) contra forexfactory.com: el dato crudo del XML + el offset
 * de Madrid (CEST, UTC+2) coincide exactamente con lo que muestra la web.
 * No se necesita ninguna conversión de zona horaria: se interpreta tal cual como UTC.
 */
function wallTimeToUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): string {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0)).toISOString();
}

function normalizeImpact(raw: unknown): EconomicEvent["impact"] {
  const value = toText(raw).trim();
  if (value === "High" || value === "Medium" || value === "Low" || value === "Holiday") {
    return value;
  }
  return "Unknown";
}

function cleanField(raw: unknown): string | null {
  const value = toText(raw).trim();
  return value.length > 0 ? value : null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Descarga el XML semanal de Forex Factory, lo parsea y lo transforma
 * en una lista de eventos normalizados, con hora en UTC real.
 * Fuente no oficial: puede cambiar de formato o bloquearse sin aviso.
 */
export async function fetchAndParseCalendar(): Promise<EconomicEvent[]> {
  const response = await fetch(FF_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) TuJournalBot/1.0",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Forex Factory respondió HTTP ${response.status}`);
  }

  const xmlText = await response.text();

  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
  });

  const parsed = parser.parse(xmlText) as {
    weeklyevents?: {event?: RawFFEvent | RawFFEvent[]};
  };

  const rawEvents = parsed.weeklyevents?.event;
  const eventList: RawFFEvent[] = Array.isArray(rawEvents) ?
    rawEvents :
    rawEvents ? [rawEvents] : [];

  const events: EconomicEvent[] = eventList.map((raw, index) => {
    const rawDate = toText(raw.date).trim();
    const rawTime = toText(raw.time).trim();

    let dateTimeUTC: string | null = null;
    const dateParts = parseDateMMDDYYYY(rawDate);
    const timeParts = parseTimeTo24h(rawTime);

    if (dateParts && timeParts) {
      dateTimeUTC = wallTimeToUtcIso(
        dateParts.year,
        dateParts.month,
        dateParts.day,
        timeParts.hour,
        timeParts.minute
      );
    }

    const title = toText(raw.title).trim() || "Evento sin título";
    const idBase = slugify(`${title}-${rawDate}-${rawTime}`) || "evento";

    return {
      id: `${idBase}-${index}`,
      title,
      country: toText(raw.country).trim() || "All",
      impact: normalizeImpact(raw.impact),
      forecast: cleanField(raw.forecast),
      previous: cleanField(raw.previous),
      url: toText(raw.url).trim(),
      dateTimeUTC,
      rawDate,
      rawTime,
    };
  });

  return events;
}

async function refreshEconomicCalendar(): Promise<void> {
  ensureFirebaseApp();
  const db = getFirestore();
  const events = await fetchAndParseCalendar();

  await db.collection("economicCalendar").doc("latest").set({
    generatedAt: new Date().toISOString(),
    events,
  });

  logger.info(`Calendario económico actualizado: ${events.length} eventos.`);
}

/**
 * Función programada: refresca el calendario económico cada hora.
 */
export const refreshEconomicCalendarScheduled = onSchedule(
  {
    schedule: "0 * * * *",
    timeZone: "Europe/Madrid",
    region: "europe-west1",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async () => {
    await refreshEconomicCalendar();
  }
);

/**
 * Función callable para forzar el refresco manualmente (debug/admin).
 */
export const refreshEconomicCalendarNow = onCall(
  {
    region: "europe-west1",
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new Error("Debes estar autenticado.");
    }
    await refreshEconomicCalendar();
    return {success: true, message: "Calendario económico actualizado."};
  }
);
