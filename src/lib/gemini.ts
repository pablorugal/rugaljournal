// src/lib/gemini.ts (NAVEGADOR)
// La clave de Gemini ya no está aquí: las llamadas pasan por la Cloud Function callGemini.
import { getFunctions, httpsCallable } from 'firebase/functions'

/* ==================== COMPRESIÓN DE IMÁGENES (a base64, para Gemini Vision) ==================== */
export function compressImage(file: File, maxWidth = 1024): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' })
      }
      img.onerror = reject
      img.src = e.target!.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/* ==================== LLAMADA A GEMINI (vía Cloud Function) ==================== */
const CALL_TIMEOUT_MS = 120000

export async function callGeminiWithFallback(body: any): Promise<string> {
  try {
    const functions = getFunctions(undefined, 'europe-west1')
    const callGemini = httpsCallable<{ body: unknown }, { text: string; model: string }>(
      functions,
      'callGemini',
      { timeout: CALL_TIMEOUT_MS }
    )
    const result = await callGemini({ body })
    const text = result.data?.text
    if (!text) throw new Error('La IA devolvió una respuesta vacía.')
    return text
  } catch (err: any) {
    console.error('callGemini error:', err)
    const code = String(err?.code ?? '')
    if (code === 'functions/unauthenticated') {
      throw new Error('Tu sesión ha caducado. Vuelve a iniciar sesión para usar Nova.')
    }
    if (code === 'functions/internal') {
      throw new Error('No se pudo conectar con la IA. Inténtalo de nuevo en unos minutos.')
    }
    if (code === 'functions/deadline-exceeded') {
      throw new Error('La IA ha tardado demasiado en responder. Inténtalo de nuevo.')
    }
    throw new Error(err?.message || 'No se pudo conectar con la IA.')
  }
}
