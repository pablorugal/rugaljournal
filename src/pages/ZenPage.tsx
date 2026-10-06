import { Play } from 'lucide-react'

export default function ZenPage() {
  const step = 0, total = 12
  const pct = Math.round((step / total) * 100)
  return (
    <div className="fixed inset-0 lg:relative lg:inset-auto bg-ink-900 text-bone-100 -m-6 md:-m-8 min-h-screen flex flex-col items-center justify-center p-8">
      <span className="text-[11px] font-semibold tracking-widest uppercase bg-white/10 px-3 py-1 rounded-full mb-6">Ritual Pre-sesión</span>
      <h1 className="serif text-5xl font-semibold mb-3">ZEN</h1>
      <p className="text-sm text-bone-100/50 max-w-md text-center mb-12">Respiración guiada con música ambiental, seguida de 5 minutos de meditación silenciosa.</p>
      <div className="relative w-56 h-56 flex items-center justify-center mb-10">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-accent/40 to-black/10 blur-2xl" />
        <div className="relative w-40 h-40 rounded-full border border-white/10 flex items-center justify-center"><span className="text-sm tracking-widest font-medium">LISTO</span></div>
      </div>
      <p className="text-sm text-bone-100/50 mb-6">Pulsa Comenzar ZEN y deja que tu respiración te guíe.</p>
      <div className="w-full max-w-xs mb-8">
        <div className="flex justify-between text-xs text-bone-100/40 mb-2"><span>PASO {step}/{total}</span><span>{pct}%</span></div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} /></div>
      </div>
      <button className="flex items-center gap-2 px-8 py-3 rounded-full bg-accent text-white font-semibold shadow-glow"><Play size={16} /> Comenzar ZEN</button>
    </div>
  )
}