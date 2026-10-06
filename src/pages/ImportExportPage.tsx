import { useState } from 'react'
import { UploadCloud, FileDown } from 'lucide-react'
import { Card, SectionHeader, PillTabs } from '../components/ui'

export default function ImportExportPage() {
  const [tab, setTab] = useState('import')
  return (
    <div>
      <SectionHeader eyebrow="Datos" title="Importar / Exportar" />
      <div className="mb-6"><PillTabs tabs={[{ id: 'import', label: 'Importar' }, { id: 'export', label: 'Exportar' }]} active={tab} onChange={setTab} /></div>
      {tab === 'import' ? (
        <Card className="p-6">
          <h3 className="serif text-xl font-semibold mb-1">Sube tus operaciones</h3>
          <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-6">Arrastra un CSV o Excel. Detectamos duplicados automáticamente y solo añadimos lo nuevo.</p>
          <div className="border-2 border-dashed border-black/10 dark:border-white/10 rounded-xl p-10 text-center mb-4">
            <UploadCloud className="mx-auto mb-3 text-ink-900/30 dark:text-bone-100/30" size={32} />
            <p className="text-sm text-ink-900/50 dark:text-bone-100/50">CSV · XLSX · PDF, máx 5MB</p>
          </div>
          <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mb-4">Duplicados detectados por Símbolo + Fecha de entrada + Precio de entrada.</p>
          <button className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium">CSV ejemplo</button>
        </Card>
      ) : (
        <Card className="p-6">
          <h3 className="serif text-xl font-semibold mb-1">Exporta tus operaciones</h3>
          <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-6">Descarga una copia de seguridad con todas tus operaciones.</p>
          <div className="grid md:grid-cols-2 gap-4">
            {['CSV (.csv)', 'Excel (.xlsx)'].map(t => (<div key={t} className="border border-black/10 dark:border-white/10 rounded-xl p-6 flex flex-col items-center gap-3"><FileDown className="text-accent" /><p className="font-medium text-sm">{t}</p><button className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold">Descargar</button></div>))}
          </div>
        </Card>
      )}
    </div>
  )
}