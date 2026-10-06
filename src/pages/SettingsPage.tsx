import { useState, useEffect } from 'react'
import { useAppData, useTheme, useAuth } from '../contexts'
import { Card, SectionHeader, Field, inputCls } from '../components/ui'

export default function SettingsPage() {
  const { settings, updateSettings } = useAppData()
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()
  const [form, setForm] = useState(settings)
  useEffect(() => { setForm(settings) }, [settings])
  const save = () => { updateSettings(form); if (form.theme !== theme) toggleTheme() }
  return (
    <div>
      <SectionHeader eyebrow="Ajustes" title="Ajustes" />
      <Card className="p-6 mb-6">
        <h3 className="serif text-xl font-semibold mb-1">Apariencia</h3>
        <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mb-4">Personaliza cómo se ve tujournal en tu dispositivo.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Tema"><select value={form.theme} onChange={e => setForm(p => ({ ...p, theme: e.target.value as any }))} className={inputCls}><option value="light">Claro</option><option value="dark">Oscuro</option></select></Field>
          <Field label="Idioma"><select value={form.language} className={inputCls} disabled><option>🇪🇸 Español</option></select><p className="text-[11px] text-ink-900/40 dark:text-bone-100/40 mt-1">Elige tu idioma preferido para la interfaz.</p></Field>
        </div>
      </Card>
      <Card className="p-6 mb-6">
        <h3 className="serif text-xl font-semibold mb-1">Trading & comisiones</h3>
        <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mb-4">Define qué se considera breakeven y las comisiones por contrato (round-turn) que se restarán automáticamente del P&L de NQ y MNQ.</p>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Umbral de breakeven (USD)"><input type="number" value={form.breakeven_threshold} onChange={e => setForm(p => ({ ...p, breakeven_threshold: Number(e.target.value) }))} className={inputCls} /><p className="text-[11px] text-ink-900/40 dark:text-bone-100/40 mt-1">Ej. 10 → trades entre -10$ y +10$ cuentan como breakeven.</p></Field>
          <Field label="Comisión NQ (USD/contrato)"><input type="number" step="0.01" value={form.commission_nq} onChange={e => setForm(p => ({ ...p, commission_nq: Number(e.target.value) }))} className={inputCls} /><p className="text-[11px] text-ink-900/40 dark:text-bone-100/40 mt-1">Típico prop firm: ~$4.00 (Apex), ~$2.80 (Topstep).</p></Field>
          <Field label="Comisión MNQ (USD/contrato)"><input type="number" step="0.01" value={form.commission_mnq} onChange={e => setForm(p => ({ ...p, commission_mnq: Number(e.target.value) }))} className={inputCls} /><p className="text-[11px] text-ink-900/40 dark:text-bone-100/40 mt-1">Típico prop firm: ~$1.04 (Apex), ~$0.74 (Topstep).</p></Field>
        </div>
      </Card>
      <button onClick={save} className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft mb-6">💾 Guardar preferencias</button>
      <Card className="p-6">
        <h3 className="serif text-xl font-semibold mb-4">Cuenta</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div><p className="text-ink-900/40 dark:text-bone-100/40 text-xs">Email</p><p>{user?.email}</p></div>
          <div><p className="text-ink-900/40 dark:text-bone-100/40 text-xs">Tipo de cuenta</p><p>Fondeada</p></div>
        </div>
      </Card>
    </div>
  )
}