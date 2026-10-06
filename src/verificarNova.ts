import { getFunctions, httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "./firebase";

export async function verificarNova() {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    console.error("❌ No hay sesión iniciada");
    return;
  }

  // auth.app es la misma app de Firebase, así no hace falta exportar "app"
  const functions = getFunctions(auth.app, "europe-west1");
  const recalc = httpsCallable(functions, "recalculateNovaInsightsNow");

  try {
    const res = await recalc();
    console.log("✅ Función OK:", res.data);
  } catch (e: any) {
    console.error("❌ Error función:", e.code, e.message);
    return;
  }

  const snap = await getDoc(doc(db, "users", uid, "novaInsights", "latest"));
  if (!snap.exists()) {
    console.error("❌ El documento latest NO existe");
    return;
  }

  console.log("✅ Documento existe. Campos:", Object.keys(snap.data()));
  console.log("Contenido completo:", snap.data());
}