import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {getApps, initializeApp} from "firebase-admin/app";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {createHash} from "node:crypto";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const joinWaitlist = onCall(
  {region: "europe-west1", maxInstances: 3, timeoutSeconds: 15},
  async (request) => {
    const data = (request.data ?? {}) as Record<string, unknown>;

    // Campo trampa: si un bot lo rellena, fingimos éxito y no guardamos nada.
    if (typeof data.website === "string" && data.website.trim() !== "") {
      return {ok: true};
    }

    const email =
      typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    if (email.length === 0 || email.length > 254 || !EMAIL_RE.test(email)) {
      throw new HttpsError("invalid-argument", "El email no es válido.");
    }
    if (data.consent !== true) {
      throw new HttpsError(
        "invalid-argument",
        "Debes aceptar que se guarde tu email para unirte a la lista."
      );
    }

    if (getApps().length === 0) initializeApp();
    const id = createHash("sha256").update(email).digest("hex");

    try {
      await getFirestore().collection("waitlist").doc(id).create({
        email,
        consent: true,
        source: "landing",
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      const code = (err as {code?: number | string}).code;
      if (code === 6 || code === "already-exists") {
        return {ok: true};
      }
      logger.error("joinWaitlist: no se pudo guardar", err);
      throw new HttpsError(
        "internal",
        "No se pudo guardar. Inténtalo de nuevo más tarde."
      );
    }

    return {ok: true};
  }
);
