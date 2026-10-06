import {HttpsError} from "firebase-functions/v2/https";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";

// Topes por usuario para callGemini.
const DAILY_LIMIT = 100;
const BURST_LIMIT = 8;
const BURST_WINDOW_MS = 60000;

function madridDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Descuenta una llamada del cupo del usuario. Lanza HttpsError
 * "resource-exhausted" si ha superado el tope diario o el de ráfaga.
 * El contador vive en usage/{uid}_{YYYY-MM-DD} y solo lo escribe el servidor.
 */
export async function consumeGeminiQuota(uid: string): Promise<void> {
  if (getApps().length === 0) initializeApp();
  const db = getFirestore();
  const now = Date.now();
  const ref = db.collection("usage").doc(`${uid}_${madridDateKey(new Date(now))}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() as {count?: number; recent?: number[]} | undefined;

    const count = typeof data?.count === "number" ? data.count : 0;
    const recentRaw = data?.recent;
    const recent = (Array.isArray(recentRaw) ? recentRaw : []).filter(
      (t) => typeof t === "number" && now - t < BURST_WINDOW_MS
    );

    if (count >= DAILY_LIMIT) {
      throw new HttpsError(
        "resource-exhausted",
        "Has alcanzado el límite diario de uso de Nova. Se restablece a medianoche (hora de Madrid)."
      );
    }
    if (recent.length >= BURST_LIMIT) {
      throw new HttpsError(
        "resource-exhausted",
        "Demasiadas peticiones seguidas. Espera un minuto e inténtalo de nuevo."
      );
    }

    tx.set(ref, {
      uid,
      count: count + 1,
      recent: [...recent, now].slice(-BURST_LIMIT),
      updatedAt: now,
    });
  });
}
