import * as logger from "firebase-functions/logger";
import type {DocumentReference} from "firebase-admin/firestore";
import {GEMINI_API_KEY, generateWithFallback} from "./gemini";
import {getConfidenceLabel} from "./calculations";
import type {NovaRankItem, NovaRankings} from "./calculations";

const TIME_ZONE = "Europe/Madrid";
const MESSAGE_BUDGET_MS = 30000; // tope total para el mensaje (el botón espera ~70 s)
const MAX_MESSAGE_CHARS = 700;
const MAX_OUTPUT_TOKENS = 4096; // margen amplio: en modelos con razonamiento, pensar también consume tokens

export interface NovaMessageInput {
  totalTrades: number;
  metrics: {
    netPnl: number;
    winRate: number;
    profitFactor: number;
    tradingDays: number;
    wins: number;
    losses: number;
    breakevens: number;
  };
  performanceScore: number | null;
  discipline: {
    daysWithData: number;
    avgScore?: number | null;
    brokenDaysCount: number;
  };
  rankings: NovaRankings;
}

const SYSTEM_PROMPT = [
  "Eres Nova, la analista de un diario de trading. Escribes el briefing diario de un trader.",
  "Reglas estrictas:",
  "- Escribe entre 2 y 3 frases, máximo 70 palabras, en español, tuteando, tono sobrio y honesto.",
  "- Texto plano: sin markdown, sin listas, sin emojis, sin saludos ni despedidas.",
  "- Usa SOLO las cifras que aparecen en los datos. No calcules ni inventes ninguna.",
  "- Los costes en dólares se citan tal cual, siempre junto al número de operaciones del grupo.",
  "- Si un patrón figura como 'Exploratoria' (pocas operaciones), exprésalo como indicio, nunca como conclusión.",
  "- Si el total de operaciones es menor de 20, di claramente que aún es pronto y que la muestra es pequeña.",
  "- No hables de rachas ni sugieras nunca que operar tras perder funcione o no funcione.",
  "- No des consejos de inversión ni predicciones de mercado. Como mucho, una sugerencia de observación (por ejemplo, revisar un patrón), nunca una orden.",
  "- Céntrate en un único patrón principal, el más relevante. No enumeres todo.",
].join("\n");

function madridDateKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function money(n: number): string {
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n < 0 ? "-" : ""}$${abs}`;
}

function describeItem(i: NovaRankItem): string {
  const tag = i.tag ? ` (${i.tag})` : "";
  return `${i.label}${tag}: ${money(i.value)} en ${i.sampleSize} operaciones, confianza ${getConfidenceLabel(i.level).label}`;
}

function describeList(items: NovaRankItem[]): string {
  if (items.length === 0) return "  (ninguno con datos suficientes)";
  return items.map((i) => `  - ${describeItem(i)}`).join("\n");
}

function buildDataText(input: NovaMessageInput): string {
  const m = input.metrics;
  const pf = Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "infinito";
  const d = input.discipline;
  const disciplineLine =
    d.daysWithData === 0 || d.avgScore === null || d.avgScore === undefined ?
      "Disciplina: sin días registrados todavía." :
      `Disciplina: media ${d.avgScore}/100 en ${d.daysWithData} días registrados; días con disciplina rota: ${d.brokenDaysCount}.`;

  return [
    "DATOS DEL TRADER (histórico completo, P&L neto):",
    `Operaciones totales: ${input.totalTrades}`,
    `Días operados: ${m.tradingDays}`,
    `Net P&L: ${money(m.netPnl)}`,
    `Win rate: ${m.winRate}% (${m.wins} ganadas, ${m.losses} perdidas, ${m.breakevens} en breakeven)`,
    `Profit factor: ${pf}`,
    `Performance score: ${input.performanceScore === null ? "sin datos" : Math.round(input.performanceScore)}/100`,
    disciplineLine,
    "Lo que más falla (coste = media por trade × nº de trades):",
    describeList(input.rankings.worst),
    "Lo que mejor funciona:",
    describeList(input.rankings.best),
    "Peores horas de entrada (hora de Madrid):",
    describeList(input.rankings.worstHours),
    "Mejores horas de entrada (hora de Madrid):",
    describeList(input.rankings.bestHours),
    "",
    "Escribe el briefing de hoy.",
  ].join("\n");
}

function cleanText(text: string): string {
  return text.replace(/[*#`]/g, "").replace(/\s+/g, " ").trim();
}

// Un texto completo acaba en signo de puntuación (o cierre de comillas/paréntesis).
function endsLikeCompleteSentence(text: string): boolean {
  return /[.!?…]["'”»)]?$/.test(text);
}

/**
 * Genera el mensaje diario de Nova como máximo una vez por día natural (Madrid).
 * Si ya existe el de hoy, no llama a Gemini. Si Gemini falla, lanza el error
 * (quien llama debe capturarlo) y NO se guarda nada: se conserva el mensaje anterior.
 * Una respuesta incompleta o cortada se descarta y tampoco se guarda.
 */
export async function ensureDailyNovaMessage(
  userRef: DocumentReference,
  input: NovaMessageInput
): Promise<void> {
  const uid = userRef.id;
  const today = madridDateKey();
  const messageRef = userRef.collection("novaInsights").doc("message");

  const existing = await messageRef.get();
  const existingData = existing.data();
  if (existing.exists && existingData?.dateKey === today && typeof existingData?.text === "string") {
    logger.info(`Mensaje Nova de hoy ya existe, se reutiliza. uid=${uid}`);
    return;
  }

  if (input.totalTrades === 0) {
    logger.info(`Mensaje Nova omitido: sin operaciones. uid=${uid}`);
    return;
  }

  const body = {
    systemInstruction: {parts: [{text: SYSTEM_PROMPT}]},
    contents: [{role: "user", parts: [{text: buildDataText(input)}]}],
    generationConfig: {temperature: 0.4, maxOutputTokens: MAX_OUTPUT_TOKENS},
  };

  const {text, model} = await generateWithFallback(GEMINI_API_KEY.value(), body, {
    totalBudgetMs: MESSAGE_BUDGET_MS,
    requireComplete: true,
  });

  const clean = cleanText(text);
  if (!clean || clean.length > MAX_MESSAGE_CHARS) {
    logger.warn(`Mensaje Nova descartado (longitud ${clean.length}). uid=${uid}`);
    return;
  }
  if (!endsLikeCompleteSentence(clean)) {
    logger.warn(`Mensaje Nova descartado: no acaba en puntuación (posible corte). uid=${uid} modelo=${model}`);
    return;
  }

  await messageRef.set({
    text: clean,
    dateKey: today,
    generatedAt: new Date().toISOString(),
    tradesCount: input.totalTrades,
    netPnl: input.metrics.netPnl,
    model,
  });
  logger.info(`Mensaje Nova generado. uid=${uid} modelo=${model}`);
}
