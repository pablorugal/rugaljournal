import {onSchedule} from "firebase-functions/v2/scheduler";
import {onCall} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";

import type {Trade, MindsetEntry, DailyBiasEntry, Strategy, UserSettings} from "./types";
import {
  computeMetrics,
  computePerformanceScore,
  computeByHour,
  calculateDisciplineScores,
  summarizeDisciplinePeriod,
  correlateDisciplineBrokenToPnl,
  correlateDayOfWeek,
  correlateSessionPerformance,
  correlateInstrumentPerformance,
  correlateStrategyPerformance,
  correlateEmotionToPerformance,
  correlateBiasAccuracy,
  setCorrelationSettings,
  correlatePostLossStreak,
  buildNovaRankings,
} from "./calculations";
import {GEMINI_API_KEY} from "./gemini";
import {ensureDailyNovaMessage} from "./novaMessage";

initializeApp();
const db = getFirestore();

const DEFAULT_SETTINGS: UserSettings = {
  theme: "light",
  language: "es",
  breakeven_threshold: 10,
  commission_nq: 4.0,
  commission_mnq: 1.04,
};

/**
 * Recalcula todos los insights de Nova para un único usuario
 * y guarda el resultado en users/{uid}/novaInsights/latest.
 * Después intenta generar el mensaje diario (máx. 1 vez al día).
 */
async function recalculateInsightsForUser(uid: string): Promise<void> {
  const userRef = db.collection("users").doc(uid);

  const [tradesSnap, mindsetSnap, biasSnap, strategiesSnap, settingsSnap] =
    await Promise.all([
      userRef.collection("trades").get(),
      userRef.collection("mindsetEntries").get(),
      userRef.collection("dailyBias").get(),
      userRef.collection("strategies").get(),
      userRef.collection("settings").doc("main").get(),
    ]);

  const trades = tradesSnap.docs.map((d) => d.data() as Trade);
  const mindsetEntries = mindsetSnap.docs.map((d) => d.data() as MindsetEntry);
  const dailyBias = biasSnap.docs.map((d) => d.data() as DailyBiasEntry);
  const strategies = strategiesSnap.docs.map((d) => d.data() as Strategy);
  const settings = settingsSnap.exists ?
    (settingsSnap.data() as UserSettings) :
    DEFAULT_SETTINGS;

  // Si el usuario no tiene ningún dato, no generamos insights vacíos
  if (trades.length === 0 && mindsetEntries.length === 0) {
    logger.info(`Usuario ${uid} sin datos, se omite.`);
    return;
  }

  setCorrelationSettings(settings);
  const metrics = computeMetrics(trades, settings);
  const performanceScore = computePerformanceScore(metrics);

  const disciplineScores = calculateDisciplineScores(mindsetEntries);
  const disciplineSummary = summarizeDisciplinePeriod(disciplineScores);

  const correlations = {
    dayOfWeek: correlateDayOfWeek(trades),
    session: correlateSessionPerformance(trades),
    instrument: correlateInstrumentPerformance(trades),
    strategy: correlateStrategyPerformance(trades, strategies),
    emotion: correlateEmotionToPerformance(trades, mindsetEntries),
    disciplineBrokenToPnl: correlateDisciplineBrokenToPnl(mindsetEntries, trades),
    biasAccuracy: correlateBiasAccuracy(dailyBias),
    postLossStreak: correlatePostLossStreak(trades),
  };

  // P&L neto por hora de entrada (hora de Madrid). Solo horas con operaciones.
  const byHour = computeByHour(trades, settings).map((h) => ({
    hour: h.hour,
    count: h.count,
    pnl: Math.round(h.pnl * 100) / 100,
    wins: h.wins,
    losses: h.losses,
    winRate: h.winRate,
  }));

  const insights = {
    generatedAt: new Date().toISOString(),
    metrics: {
      netPnl: metrics.netPnl,
      winRate: metrics.winRate,
      profitFactor: metrics.profitFactor,
      tradingDays: metrics.tradingDays,
      wins: metrics.wins,
      losses: metrics.losses,
      breakevens: metrics.breakevens,
    },
    performanceScore,
    discipline: {
      summary: disciplineSummary,
      dailyScores: disciplineScores.slice(-90), // últimos 90 días, evita documentos gigantes
    },
    correlations,
    byHour,
  };

  await userRef.collection("novaInsights").doc("latest").set(insights);
  logger.info(`Insights recalculados para usuario ${uid}`);

  // Mensaje diario de Nova. Si falla, el recálculo ya está guardado y no se rompe.
  try {
    await ensureDailyNovaMessage(userRef, {
      totalTrades: trades.length,
      metrics: insights.metrics,
      performanceScore,
      discipline: disciplineSummary,
      rankings: buildNovaRankings(
        {
          dayOfWeek: correlations.dayOfWeek.groups,
          session: correlations.session.groups,
          strategy: correlations.strategy.groups,
          emotion: correlations.emotion.groups,
        },
        byHour
      ),
    });
  } catch (err) {
    logger.warn(`No se pudo generar el mensaje Nova de ${uid}:`, err);
  }
}

/**
 * Recorre todos los usuarios y recalcula sus insights.
 * Usa listDocuments() porque también devuelve documentos "fantasma"
 * (users/{uid} sin campos propios, solo con subcolecciones).
 */
async function recalculateAllUsers(): Promise<void> {
  const userRefs = await db.collection("users").listDocuments();
  logger.info(`Recalculando insights para ${userRefs.length} usuarios...`);

  for (const userRef of userRefs) {
    try {
      await recalculateInsightsForUser(userRef.id);
    } catch (err) {
      logger.error(`Error recalculando insights de ${userRef.id}:`, err);
    }
  }

  logger.info("Recalculo diario completado.");
}

/**
 * Función programada: se ejecuta todos los días a las 00:00 (Europe/Madrid)
 */
export const dailyNovaRecalculation = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "Europe/Madrid",
    region: "europe-west1",
    memory: "512MiB",
    timeoutSeconds: 300,
    secrets: [GEMINI_API_KEY],
  },
  async () => {
    await recalculateAllUsers();
  }
);

/**
 * Función callable para forzar el recálculo desde el frontend.
 * Los números se recalculan siempre; el mensaje de Nova, solo si aún no hay el de hoy.
 */
export const recalculateNovaInsightsNow = onCall(
  {
    region: "europe-west1",
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 90,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new Error("Debes estar autenticado para recalcular tus insights.");
    }
    await recalculateInsightsForUser(uid);
    return {success: true, message: "Insights recalculados correctamente."};
  }
);
export {callGemini} from "./gemini";
export {joinWaitlist} from "./waitlist";
export {refreshEconomicCalendarScheduled, refreshEconomicCalendarNow} from "./economicCalendar";
