// src/lib/gemini.ts

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
  
  /* ==================== LLAMADA A GEMINI CON FALLBACK DE MODELOS ==================== */
  export const MODEL_FALLBACK_LIST = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-2.5-pro',
  ]
  
  export async function callGeminiWithFallback(apiKey: string, body: any): Promise<string> {
    let lastError = ''
    for (const model of MODEL_FALLBACK_LIST) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        )
        const data = await response.json()
        if (data.error) {
          lastError = data.error.message || 'Error desconocido'
          console.warn(`Modelo ${model} falló: ${lastError}`)
          continue
        }
        const respuesta = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (respuesta) {
          console.log(`✅ Respuesta exitosa con modelo: ${model}`)
          return respuesta
        }
        lastError = 'Respuesta vacía del modelo'
      } catch (err: any) {
        lastError = err.message || 'Error de red'
        console.warn(`Modelo ${model} falló con excepción: ${lastError}`)
      }
    }
    throw new Error(`Todos los modelos fallaron. Último error: ${lastError}`)
  }