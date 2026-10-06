type Props = { label: string; src?: string; alt?: string }

export default function BrowserFrame({ label, src, alt = '' }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#34363C] bg-[#212327] shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
      <div className="flex items-center gap-2 border-b border-[#34363C] px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#3A3D44]" />
        <span className="h-3 w-3 rounded-full bg-[#3A3D44]" />
        <span className="h-3 w-3 rounded-full bg-[#3A3D44]" />
        <span className="landing-mono ml-3 rounded-md bg-[#17181B] px-3 py-1 text-[11px] text-[#BDB9B0]">{label}</span>
      </div>
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="block w-full" />
      ) : (
        <div className="flex aspect-[16/10] flex-col items-center justify-center gap-2 bg-[radial-gradient(ellipse_at_center,rgba(212,175,106,0.07),transparent_70%)]">
          <span className="landing-mono text-xs uppercase tracking-[0.2em] text-[#BDB9B0]">Captura de demo</span>
          <span className="text-xs text-[#BDB9B0]/60">Próximamente</span>
        </div>
      )}
    </div>
  )
}
