import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useAppData, useTheme, useAuth, type Palette } from '../contexts'
import { Card, SectionHeader, Field, inputCls, Modal } from '../components/ui'
import { db, storage } from '../firebase'
import { doc, writeBatch } from 'firebase/firestore'
import { ref, listAll, deleteObject } from 'firebase/storage'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, deleteUser } from 'firebase/auth'
import { Check, Lock, Download, Trash2, AlertTriangle } from 'lucide-react'

const PALETTES_UI: { id: Palette; label: string; swatch: string }[] = [
  { id: 'dorado', label: 'Dorado', swatch: '#B38A3C' },
  { id: 'negro', label: 'Negro', swatch: '#18181B' },
  { id: 'grafito', label: 'Grafito', swatch: '#4A3F33' },
  { id: 'plata', label: 'Plata', swatch: '#52525B' },
]

async function deleteStorageFolder(folderRef: ReturnType<typeof ref>) {
  const result = await listAll(folderRef)
  await Promise.all(result.items.map(item => deleteObject(item).catch(() => {})))
  await Promise.all(result.prefixes.map(prefix => deleteStorageFolder(prefix)))
}

function DeleteAccountModal({ open, onClose, allIds, uid, userEmail }: {
  open: boolean
  onClose: () => void
  allIds: Record<string, string[]>
  uid: string
  userEmail: string | null
}) {
  const { user } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'confirm' | 'done'>('confirm')

  const canConfirm = confirmText.trim().toUpperCase() === 'ELIMINAR' && password.length > 0

  const handleDelete = async () => {
    if (!user || !userEmail) return
    setError('')
    setLoading(true)
    try {
      const credential = EmailAuthProvider.credential(userEmail, password)
      await reauthenticateWithCredential(user, credential)

      const CHUNK = 400
      const ops: { collection: string; id: string }[] = []
      for (const [col, ids] of Object.entries(allIds)) {
        ids.forEach(id => ops.push({ collection: col, id }))
      }
      ops.push({ collection: 'settings', id: 'main' })
      for (let i = 0; i < ops.length; i += CHUNK) {
        const batch = writeBatch(db)
        ops.slice(i, i + CHUNK).forEach(({ collection: col, id }) => {
          batch.delete(doc(db, 'users', uid, col, id))
        })
        await batch.commit()
      }

      try {
        await deleteStorageFolder(ref(storage, `users/${uid}`))
      } catch (storageErr) {
        console.error('Error al borrar archivos de Storage (continuando igualmente):', storageErr)
      }

      await deleteUser(user)
      setStep('done')
    } catch (err: any) {
      const messages: Record<string, string> = {
        'auth/wrong-password': 'La contraseña es incorrecta.',
        'auth/invalid-credential': 'La contraseña es incorrecta.',
        'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
        'auth/requires-recent-login': 'Por seguridad, cierra sesión y vuelve a entrar antes de eliminar la cuenta.',
      }
      setError(messages[err.code] || 'No se pudo eliminar la cuenta. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setPassword(''); setConfirmText(''); setError(''); setStep('confirm')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} widthClass="max-w-md">
      {step === 'confirm' ? (
        <>
          <div className="flex items-center gap-2 mb-3 text-loss">
            <AlertTriangle size={20} />
            <h2 className="serif text-xl font-semibold">Eliminar cuenta</h2>
          </div>
          <p className="text-sm text-ink-900/60 dark:text-bone-100/60 mb-4">
            Esta acción es <strong>irreversible</strong>. Se borrarán permanentemente todas tus operaciones, cuentas, estrategias, checklists, hábitos, journal y capturas. No podrás recuperarlos.
          </p>
          <Field label='Escribe "ELIMINAR" para confirmar'>
            <input value={confirmText} onChange={e => setConfirmText(e.target.value)} className={inputCls} placeholder="ELIMINAR" />
          </Field>
          <div className="mt-3">
            <Field label="Tu contraseña">
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} placeholder="••••••••" />
            </Field>
          </div>
          {error && <p className="text-xs text-loss mt-3">{error}</p>}
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={handleClose} className="px-5 py-2.5 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canConfirm || loading}
              className="px-5 py-2.5 rounded-lg bg-loss text-white text-sm font-semibold disabled:opacity-50"
            >
              {loading ? 'Eliminando...' : 'Eliminar mi cuenta para siempre'}
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className="serif text-xl font-semibold mb-2">Cuenta eliminada</h2>
          <p className="text-sm text-ink-900/60 dark:text-bone-100/60">Tu cuenta y todos tus datos se han borrado. Gracias por probar Tradelic.</p>
        </>
      )}
    </Modal>
  )
}

export default function SettingsPage() {
  const {
    settings, updateSettings,
    trades, strategies, checklists, habitRules, habitLogs,
    dailyBias, weeklyOutlooks, mindsetEntries, journalEntries,
    accounts, capitalFlows, conversations, weeklyReviews,
  } = useAppData()
  const { theme, toggleTheme, palette, setPalette } = useTheme()
  const { user } = useAuth()
  const [form, setForm] = useState(settings)
  useEffect(() => { setForm(settings) }, [settings])
  const save = () => { updateSettings(form); if (form.theme !== theme) toggleTheme() }

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault()
    setPwError(''); setPwSuccess('')
    if (newPw.length < 6) { setPwError('La nueva contraseña debe tener al menos 6 caracteres.'); return }
    if (newPw !== confirmPw) { setPwError('Las contraseñas nuevas no coinciden.'); return }
    if (!user?.email) { setPwError('No se pudo identificar tu email.'); return }
    setPwLoading(true)
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPw)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, newPw)
      setPwSuccess('Contraseña actualizada correctamente.')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (err: any) {
      const messages: Record<string, string> = {
        'auth/wrong-password': 'La contraseña actual es incorrecta.',
        'auth/invalid-credential': 'La contraseña actual es incorrecta.',
        'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
        'auth/requires-recent-login': 'Por seguridad, cierra sesión y vuelve a entrar antes de cambiar la contraseña.',
        'auth/weak-password': 'La nueva contraseña es demasiado débil.',
      }
      setPwError(messages[err.code] || 'No se pudo cambiar la contraseña. Inténtalo de nuevo.')
    } finally {
      setPwLoading(false)
    }
  }

  const handleExport = () => {
    const data = {
      exported_at: new Date().toISOString(),
      user_email: user?.email,
      trades, strategies, checklists, habitRules, habitLogs,
      dailyBias, weeklyOutlooks, mindsetEntries, journalEntries,
      accounts, capitalFlows, conversations, weeklyReviews, settings,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tradelic-datos-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const allIds: Record<string, string[]> = {
    trades: trades.map(t => t.id),
    strategies: strategies.map(s => s.id),
    checklists: checklists.map(c => c.id),
    habitRules: habitRules.map(r => r.id),
    habitLogs: habitLogs.map(l => l.id),
    dailyBias: dailyBias.map(d => d.id),
    weeklyOutlooks: weeklyOutlooks.map(w => w.id),
    mindsetEntries: mindsetEntries.map(m => m.id),
    journalEntries: journalEntries.map(j => j.id),
    accounts: accounts.map(a => a.id),
    capitalFlows: capitalFlows.map(f => f.id),
    conversations: conversations.map(c => c.id),
    weeklyReviews: weeklyReviews.map(w => w.id),
  }

  return (
    <div>
      <SectionHeader eyebrow="Ajustes" title="Ajustes" />

      <Card className="p-6 mb-6">
        <h3 className="serif text-xl font-semibold mb-1">Apariencia</h3>
        <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mb-4">Personaliza cómo se ve Tradelic en tu dispositivo.</p>
        <div className="grid md:grid-cols-2 gap-4 mb-5">
          <Field label="Tema"><select value={form.theme} onChange={e => setForm(p => ({ ...p, theme: e.target.value as any }))} className={inputCls}><option value="light">Claro</option><option value="dark">Oscuro</option></select></Field>
          <Field label="Idioma"><select value={form.language} className={inputCls} disabled><option>🇪🇸 Español</option></select><p className="text-[11px] text-ink-900/40 dark:text-bone-100/40 mt-1">Elige tu idioma preferido para la interfaz.</p></Field>
        </div>
        <Field label="Paleta de color">
          <div className="flex gap-3">
            {PALETTES_UI.map(p => (
              <button key={p.id} type="button" onClick={() => setPalette(p.id)} className="flex flex-col items-center gap-1.5 group">
                <span
                  className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition ${palette === p.id ? 'border-accent' : 'border-black/10 dark:border-white/15'}`}
                  style={{ backgroundColor: p.swatch }}
                >
                  {palette === p.id && <Check size={15} className="text-white drop-shadow" />}
                </span>
                <span className="text-[11px] text-ink-900/50 dark:text-bone-100/50 group-hover:text-ink-900 dark:group-hover:text-bone-100">{p.label}</span>
              </button>
            ))}
          </div>
        </Field>
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

      <Card className="p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Lock size={18} className="text-accent" />
          <h3 className="serif text-xl font-semibold">Seguridad</h3>
        </div>
        <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mb-4">Cambia la contraseña de tu cuenta.</p>
        <form onSubmit={handleChangePassword} className="grid md:grid-cols-3 gap-4 items-end">
          <Field label="Contraseña actual"><input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className={inputCls} placeholder="••••••••" /></Field>
          <Field label="Nueva contraseña"><input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className={inputCls} placeholder="Mínimo 6 caracteres" /></Field>
          <Field label="Repite la nueva contraseña"><input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className={inputCls} placeholder="••••••••" /></Field>
          <div className="md:col-span-3">
            {pwError && <p className="text-xs text-loss mb-2">{pwError}</p>}
            {pwSuccess && <p className="text-xs text-profit mb-2">{pwSuccess}</p>}
            <button type="submit" disabled={pwLoading || !currentPw || !newPw || !confirmPw} className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft disabled:opacity-50">
              {pwLoading ? 'Actualizando...' : 'Cambiar contraseña'}
            </button>
          </div>
        </form>
      </Card>

      <Card className="p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Download size={18} className="text-accent" />
          <h3 className="serif text-xl font-semibold">Tus datos</h3>
        </div>
        <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-4">
          Descarga una copia completa de todos tus datos (operaciones, cuentas, estrategias, checklists, hábitos, journal y ajustes) en formato JSON.
        </p>
        <button onClick={handleExport} className="px-5 py-2.5 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">
          Exportar todos mis datos
        </button>
      </Card>

      <Card className="p-6 mb-6">
        <h3 className="serif text-xl font-semibold mb-4">Cuenta</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm mb-6">
          <div><p className="text-ink-900/40 dark:text-bone-100/40 text-xs">Email</p><p>{user?.email}</p></div>
          <div><p className="text-ink-900/40 dark:text-bone-100/40 text-xs">Tipo de cuenta</p><p>Fondeada</p></div>
        </div>
        <div className="h-px bg-black/10 dark:bg-white/10 mb-5" />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-loss flex items-center gap-1.5"><AlertTriangle size={14} /> Zona de peligro</p>
            <p className="text-xs text-ink-900/50 dark:text-bone-100/50 mt-1 max-w-md">Eliminar tu cuenta borra permanentemente todas tus operaciones y datos. No se puede deshacer.</p>
          </div>
          <button onClick={() => setShowDeleteModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-loss/30 text-loss text-sm font-medium hover:bg-loss/10 transition shrink-0">
            <Trash2 size={15} /> Eliminar cuenta
          </button>
        </div>
      </Card>

      <DeleteAccountModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        allIds={allIds}
        uid={user?.uid || ''}
        userEmail={user?.email || null}
      />
    </div>
  )
}
