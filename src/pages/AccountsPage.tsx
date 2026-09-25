import React, { useEffect, useMemo, useState } from 'react'
import {
  Wallet, Plus, Pencil, Trash2, AlertTriangle, ChevronDown, ChevronUp,
  Coins, LineChart, Repeat, Boxes, ListChecks, DollarSign, CalendarDays, FileText,
} from 'lucide-react'
import { useAppData } from '../contexts'
import { fmt, todayISO } from '../utils'
import { getNetPnl, computeAccountStats, groupAccountsByPhase } from '../calculations'
import type { TradingAccount, InstrumentType, AccountCategory, AccountPhase, AccountStatus } from '../types'
import { Card, SectionHeader, PillTabs, ChipButton, Field, inputCls, Modal, StatCard, MiniMetric, Block } from '../components/ui'

/* ==================== HELPERS ==================== */
interface AccountFormState {
  name: string
  instrument_type: InstrumentType
  category: AccountCategory
  phase: AccountPhase | ''
  broker: string
  status: AccountStatus
  currency: string
  initial_balance: string
  profit_target_pct: string
  start_date: string
  notes: string
}

const emptyAccountForm: AccountFormState = {
  name: '', instrument_type: 'Forex', category: 'Prop Firm', phase: 'Fase 1',
  broker: '', status: 'Activa', currency: 'USD', initial_balance: '', profit_target_pct: '',
  start_date: todayISO(), notes: '',
}

function accountToForm(a: TradingAccount): AccountFormState {
  return {
    name: a.name, instrument_type: a.instrument_type, category: a.category, phase: a.phase || '',
    broker: a.broker || '', status: a.status, currency: a.currency || 'USD',
    initial_balance: String(a.initial_balance ?? ''),
    profit_target_pct: a.profit_target_pct !== undefined ? String(a.profit_target_pct) : '',
    start_date: a.start_date || todayISO(), notes: a.notes || '',
  }
}

const canBePropFirm = (type: InstrumentType) => type === 'Forex' || type === 'Futuros'
const phaseOptions = (type: InstrumentType): AccountPhase[] =>
  type === 'Forex' ? ['Fase 1', 'Fase 2', 'Funded'] : type === 'Futuros' ? ['Challenge', 'Funded'] : []

const STATUS_STYLES: Record<AccountStatus, string> = {
  Activa: 'bg-accent/10 text-accent',
  Funded: 'bg-profit/10 text-profit',
  Quemada: 'bg-loss/10 text-loss',
  Pausada: 'bg-amber-400/10 text-amber-500',
  Archivada: 'bg-black/5 dark:bg-white/10 text-ink-900/50 dark:text-bone-100/50',
}
function StatusBadge({ status }: { status: AccountStatus }) {
  return <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${STATUS_STYLES[status]}`}>{status}</span>
}

const INSTRUMENT_ICONS: Record<InstrumentType, any> = {
  Forex: Repeat, Futuros: Boxes, Acciones: LineChart, Crypto: Coins, Opciones: ListChecks,
}
function InstrumentBadge({ type }: { type: InstrumentType }) {
  const Icon = INSTRUMENT_ICONS[type] || Boxes
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold uppercase px-2 py-1 rounded-full bg-black/5 dark:bg-white/10 text-ink-900/60 dark:text-bone-100/60">
      <Icon size={11} /> {type}
    </span>
  )
}

/* ==================== FORM BODY (compartido crear/editar) ==================== */
function AccountFormBody({ form, setForm }: { form: AccountFormState; setForm: React.Dispatch<React.SetStateAction<AccountFormState>> }) {
  const set = (key: keyof AccountFormState) => (e: any) => {
    const value = e?.target ? e.target.value : e
    setForm(prev => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    if (!canBePropFirm(form.instrument_type) && form.category === 'Prop Firm') {
      setForm(prev => ({ ...prev, category: 'Capital Real', phase: '' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.instrument_type])

  useEffect(() => {
    if (form.category === 'Prop Firm') {
      const opts = phaseOptions(form.instrument_type)
      if (!opts.includes(form.phase as AccountPhase)) {
        setForm(prev => ({ ...prev, phase: opts[0] || '' }))
      }
    } else if (form.phase !== '') {
      setForm(prev => ({ ...prev, phase: '' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.category, form.instrument_type])

  return (
    <div className="space-y-8">
      <Block icon={Wallet} title="Identificación" first>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Nombre de la cuenta"><input value={form.name} onChange={set('name')} placeholder="Ej: FTMO 100k, IBKR Real..." className={inputCls} /></Field>
          <Field label="Broker / Prop Firm"><input value={form.broker} onChange={set('broker')} placeholder="FTMO, Topstep, IBKR, Binance..." className={inputCls} /></Field>
        </div>
      </Block>

      <Block icon={LineChart} title="Instrumento y Tipo">
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <Field label="Instrumento">
            <select value={form.instrument_type} onChange={set('instrument_type')} className={inputCls}>
              <option>Forex</option><option>Futuros</option><option>Acciones</option><option>Crypto</option><option>Opciones</option>
            </select>
          </Field>
          <Field label="Divisa"><input value={form.currency} onChange={set('currency')} placeholder="USD" className={inputCls} /></Field>
        </div>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <ChipButton active={form.category === 'Prop Firm'} onClick={() => canBePropFirm(form.instrument_type) && setForm(p => ({ ...p, category: 'Prop Firm' }))}>Prop Firm</ChipButton>
          <ChipButton active={form.category === 'Capital Real'} onClick={() => setForm(p => ({ ...p, category: 'Capital Real' }))}>Capital Real</ChipButton>
          {!canBePropFirm(form.instrument_type) && (
            <span className="text-[11px] text-ink-900/40 dark:text-bone-100/40">Solo Forex y Futuros pueden ser Prop Firm</span>
          )}
        </div>
        {form.category === 'Prop Firm' && (
          <Field label="Fase">
            <div className="flex flex-wrap gap-2">
              {phaseOptions(form.instrument_type).map(p => (
                <ChipButton key={p} active={form.phase === p} onClick={() => setForm(prev => ({ ...prev, phase: p }))}>{p}</ChipButton>
              ))}
            </div>
          </Field>
        )}
      </Block>

      <Block icon={DollarSign} title="Capital">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Capital inicial"><input type="number" step="0.01" value={form.initial_balance} onChange={set('initial_balance')} className={inputCls} /></Field>
          {form.category === 'Prop Firm' && form.phase !== 'Funded' && (
            <Field label="Objetivo de profit (%) — opcional">
              <input type="number" step="0.1" value={form.profit_target_pct} onChange={set('profit_target_pct')} placeholder="Ej: 8" className={inputCls} />
            </Field>
          )}
        </div>
        <p className="text-[11px] text-ink-900/40 dark:text-bone-100/40 mt-2">El balance actual se calcula automáticamente sumando el P&L neto de las operaciones vinculadas a esta cuenta.</p>
      </Block>

      <Block icon={CalendarDays} title="Estado">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Fecha de inicio"><input type="date" value={form.start_date} onChange={set('start_date')} className={inputCls} /></Field>
          <Field label="Estado">
            <select value={form.status} onChange={set('status')} className={inputCls}>
              <option>Activa</option><option>Funded</option><option>Pausada</option><option>Quemada</option><option>Archivada</option>
            </select>
          </Field>
        </div>
      </Block>

      <Block icon={FileText} title="Notas">
        <textarea rows={3} value={form.notes} onChange={set('notes')} placeholder="Reglas específicas, recordatorios..." className={inputCls} />
      </Block>
    </div>
  )
}

/* ==================== NUEVA CUENTA (modal) ==================== */
function NewAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { upsertAccount } = useAppData()
  const [form, setForm] = useState<AccountFormState>(emptyAccountForm)

  useEffect(() => { if (open) setForm(emptyAccountForm) }, [open])

  const handleSubmit = () => {
    if (!form.name.trim()) return
    const account: TradingAccount = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      instrument_type: form.instrument_type,
      category: form.category,
      phase: form.category === 'Prop Firm' ? (form.phase || undefined) : undefined,
      broker: form.broker || undefined,
      status: form.status,
      currency: form.currency || 'USD',
      initial_balance: Number(form.initial_balance) || 0,
      profit_target_pct: form.profit_target_pct !== '' ? Number(form.profit_target_pct) : undefined,
      start_date: form.start_date,
      notes: form.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    upsertAccount(account)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} widthClass="max-w-2xl">
      <h2 className="serif text-2xl font-semibold mb-1">Nueva Cuenta</h2>
      <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-8">Registra una cuenta de prop firm o de capital real.</p>
      <AccountFormBody form={form} setForm={setForm} />
      <div className="flex justify-end gap-3 pt-6">
        <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">Cancelar</button>
        <button type="button" onClick={handleSubmit} className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light">Crear cuenta</button>
      </div>
    </Modal>
  )
}

/* ==================== DETALLE / EDITAR / ELIMINAR ==================== */
function AccountDetailModal({ account, onClose }: { account: TradingAccount | null; onClose: () => void }) {
  const { trades, settings, upsertAccount, deleteAccount } = useAppData()
  const [mode, setMode] = useState<'view' | 'edit' | 'confirmDelete'>('view')
  const [form, setForm] = useState<AccountFormState>(emptyAccountForm)

  useEffect(() => {
    if (account) { setForm(accountToForm(account)); setMode('view') }
  }, [account])

  if (!account) return null
  const stats = computeAccountStats(account, trades, settings)
  const linkedTrades = trades.filter(t => t.account_id === account.id)
    .sort((a, b) => new Date(b.exit_datetime).getTime() - new Date(a.exit_datetime).getTime())

  const handleSaveEdit = () => {
    const updated: TradingAccount = {
      ...account,
      name: form.name.trim() || account.name,
      instrument_type: form.instrument_type,
      category: form.category,
      phase: form.category === 'Prop Firm' ? (form.phase || undefined) : undefined,
      broker: form.broker || undefined,
      status: form.status,
      currency: form.currency || 'USD',
      initial_balance: Number(form.initial_balance) || 0,
      profit_target_pct: form.profit_target_pct !== '' ? Number(form.profit_target_pct) : undefined,
      start_date: form.start_date,
      notes: form.notes,
      updated_at: new Date().toISOString(),
    }
    upsertAccount(updated)
    setMode('view')
  }

  const confirmAndDelete = () => { deleteAccount(account.id); onClose() }

  return (
    <Modal open={!!account} onClose={onClose} widthClass="max-w-2xl">
      {mode === 'view' && (
        <div>
          <div className="flex items-start justify-between mb-6 pr-8">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <InstrumentBadge type={account.instrument_type} />
                <StatusBadge status={account.status} />
                {account.category === 'Prop Firm' && account.phase && (
                  <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-black/5 dark:bg-white/10 text-ink-900/60 dark:text-bone-100/60">{account.phase}</span>
                )}
              </div>
              <h2 className="serif text-2xl font-semibold">{account.name}</h2>
              {account.broker && <p className="text-xs text-ink-900/40 dark:text-bone-100/40 mt-0.5">{account.broker}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setMode('edit')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5">
                <Pencil size={13} /> Editar
              </button>
              <button onClick={() => setMode('confirmDelete')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-loss/30 text-loss text-xs font-medium hover:bg-loss/10">
                <Trash2 size={13} /> Eliminar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <StatCard label="Balance actual" value={fmt(stats.balance)} positive={stats.netPnl >= 0} />
            <StatCard label="P&L acumulado" value={`${stats.netPnl >= 0 ? '+' : ''}${fmt(stats.netPnl)}`} positive={stats.netPnl >= 0} />
            <StatCard label="Rendimiento" value={`${stats.pnlPct >= 0 ? '+' : ''}${stats.pnlPct}%`} positive={stats.pnlPct >= 0} />
          </div>

          {stats.progressPct !== null && (
            <div className="mb-6">
              <div className="flex justify-between text-xs text-ink-900/50 dark:text-bone-100/50 mb-1">
                <span>Progreso hacia el objetivo ({account.profit_target_pct}%)</span><span>{stats.progressPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-black/10 dark:bg-white/10">
                <div className="h-full rounded-full bg-accent" style={{ width: `${stats.progressPct}%` }} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-6">
            <MiniMetric label="Capital inicial" value={fmt(account.initial_balance)} />
            <MiniMetric label="Nº de trades" value={String(stats.tradesCount)} />
            <MiniMetric label="Divisa" value={account.currency} />
            <MiniMetric label="Inicio" value={account.start_date ? new Date(account.start_date + 'T00:00:00').toLocaleDateString() : '—'} />
          </div>

          {account.notes && (
            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-1">Notas</p>
              <p className="text-sm whitespace-pre-wrap">{account.notes}</p>
            </div>
          )}

          <div>
            <p className="text-xs uppercase tracking-widest text-ink-900/40 dark:text-bone-100/40 mb-2">Operaciones vinculadas ({linkedTrades.length})</p>
            {linkedTrades.length === 0 ? (
              <p className="text-sm text-ink-900/40 dark:text-bone-100/40 py-4 text-center">Aún no hay operaciones vinculadas a esta cuenta.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {linkedTrades.map(t => {
                  const net = getNetPnl(t, settings)
                  return (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-black/5 dark:border-white/5 text-sm">
                      <div>
                        <span className="font-medium">{t.symbol}</span>
                        <span className="text-xs text-ink-900/40 dark:text-bone-100/40 ml-2">{new Date(t.exit_datetime).toLocaleDateString()}</span>
                      </div>
                      <span className={`font-medium ${net >= 0 ? 'text-profit' : 'text-loss'}`}>{fmt(net)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {mode === 'edit' && (
        <div>
          <h2 className="serif text-2xl font-semibold mb-1">Editar Cuenta</h2>
          <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-8">{account.name}</p>
          <AccountFormBody form={form} setForm={setForm} />
          <div className="flex justify-end gap-3 pt-6">
            <button type="button" onClick={() => setMode('view')} className="px-5 py-2.5 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">Cancelar</button>
            <button type="button" onClick={handleSaveEdit} className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light">Guardar cambios</button>
          </div>
        </div>
      )}

      {mode === 'confirmDelete' && (
        <div className="text-center py-6">
          <div className="w-14 h-14 rounded-full bg-loss/10 text-loss flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={26} />
          </div>
          <h2 className="serif text-xl font-semibold mb-2">¿Eliminar esta cuenta?</h2>
          <p className="text-sm text-ink-900/50 dark:text-bone-100/50 mb-6">
            Estás a punto de eliminar <strong>{account.name}</strong>. Los trades vinculados no se eliminarán, pero perderán la referencia a esta cuenta.
          </p>
          <div className="flex justify-center gap-3">
            <button onClick={() => setMode('view')} className="px-5 py-2.5 rounded-lg border border-black/10 dark:border-white/10 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">Cancelar</button>
            <button onClick={confirmAndDelete} className="px-5 py-2.5 rounded-lg bg-loss text-white text-sm font-semibold hover:opacity-90">Sí, eliminar</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ==================== TARJETA DE CUENTA ==================== */
function AccountCard({ account, stats, onClick }: { account: TradingAccount; stats: ReturnType<typeof computeAccountStats>; onClick: () => void }) {
  return (
    <Card className="p-5 cursor-pointer hover:shadow-md transition" onClick={onClick}>
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          {account.broker && <p className="text-[11px] font-medium text-ink-900/40 dark:text-bone-100/40 mb-0.5 truncate">{account.broker}</p>}
          <h3 className="font-semibold text-base truncate">{account.name}</h3>
        </div>
        <StatusBadge status={account.status} />
      </div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <InstrumentBadge type={account.instrument_type} />
        {account.category === 'Prop Firm' && account.phase && (
          <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-black/5 dark:bg-white/10 text-ink-900/60 dark:text-bone-100/60">{account.phase}</span>
        )}
        {account.category === 'Capital Real' && (
          <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-black/5 dark:bg-white/10 text-ink-900/60 dark:text-bone-100/60">Capital Real</span>
        )}
      </div>
      <p className="text-2xl font-semibold mb-1">{fmt(stats.balance)}</p>
      <p className={`text-xs font-medium mb-4 ${stats.netPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
        {stats.netPnl >= 0 ? '+' : ''}{fmt(stats.netPnl)} ({stats.pnlPct >= 0 ? '+' : ''}{stats.pnlPct}%)
      </p>
      {stats.progressPct !== null ? (
        <div>
          <div className="flex justify-between text-[10px] text-ink-900/40 dark:text-bone-100/40 mb-1">
            <span>Progreso objetivo</span><span>{stats.progressPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10">
            <div className="h-full rounded-full bg-accent" style={{ width: `${stats.progressPct}%` }} />
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-ink-900/30 dark:text-bone-100/30">{stats.tradesCount} operaciones</p>
      )}
    </Card>
  )
}

/* ==================== TARJETA DE GRUPO ==================== */
function GroupCard({ group, accountsStats, onSelectAccount }: {
  group: ReturnType<typeof groupAccountsByPhase>[number]
  accountsStats: Record<string, ReturnType<typeof computeAccountStats>>
  onSelectAccount: (a: TradingAccount) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const netPnlPct = group.initial > 0 ? +(((group.balance - group.initial) / group.initial) * 100).toFixed(2) : 0
  return (
    <Card className="p-5">
      <button type="button" onClick={() => setExpanded(e => !e)} className="w-full flex items-center justify-between">
        <div className="text-left">
          <p className="text-xs font-medium text-ink-900/40 dark:text-bone-100/40 mb-0.5">{group.accounts.length} cuenta{group.accounts.length !== 1 ? 's' : ''}</p>
          <h3 className="font-semibold text-base">{group.label}</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xl font-semibold">{fmt(group.balance)}</p>
            <p className={`text-xs font-medium ${group.netPnl >= 0 ? 'text-profit' : 'text-loss'}`}>{group.netPnl >= 0 ? '+' : ''}{fmt(group.netPnl)} ({netPnlPct >= 0 ? '+' : ''}{netPnlPct}%)</p>
          </div>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>
      {expanded && (
        <div className="mt-5 pt-5 border-t border-black/5 dark:border-white/5 grid md:grid-cols-2 gap-4">
          {group.accounts.map(acc => (
            <AccountCard key={acc.id} account={acc} stats={accountsStats[acc.id]} onClick={() => onSelectAccount(acc)} />
          ))}
        </div>
      )}
    </Card>
  )
}

/* ==================== PÁGINA PRINCIPAL ==================== */
const INSTRUMENT_FILTERS: ('Todas' | InstrumentType)[] = ['Todas', 'Forex', 'Futuros', 'Acciones', 'Crypto', 'Opciones']

export default function AccountsPage() {
  const { accounts, trades, settings } = useAppData()
  const [viewMode, setViewMode] = useState<'accounts' | 'groups'>('accounts')
  const [statusTab, setStatusTab] = useState<'active' | 'history'>('active')
  const [instrumentFilter, setInstrumentFilter] = useState<'Todas' | InstrumentType>('Todas')
  const [showNewModal, setShowNewModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null)

  const filtered = useMemo(() => accounts.filter(a => {
    const isHistory = a.status === 'Quemada' || a.status === 'Archivada'
    if (statusTab === 'active' && isHistory) return false
    if (statusTab === 'history' && !isHistory) return false
    if (instrumentFilter !== 'Todas' && a.instrument_type !== instrumentFilter) return false
    return true
  }), [accounts, statusTab, instrumentFilter])

  const accountsStats = useMemo(() => {
    const map: Record<string, ReturnType<typeof computeAccountStats>> = {}
    filtered.forEach(a => { map[a.id] = computeAccountStats(a, trades, settings) })
    return map
  }, [filtered, trades, settings])

  const globalStats = useMemo(() => {
    let totalCapital = 0, totalPnl = 0, active = 0, funded = 0
    filtered.forEach(a => {
      const s = accountsStats[a.id]
      totalCapital += s.balance
      totalPnl += s.netPnl
      if (a.status === 'Activa') active++
      if (a.status === 'Funded') funded++
    })
    return { totalCapital, totalPnl, active, funded }
  }, [filtered, accountsStats])

  const groups = useMemo(() => groupAccountsByPhase(filtered, trades, settings), [filtered, trades, settings])

  // Mantener sincronizado el modal de detalle si la cuenta cambia
  useEffect(() => {
    if (selectedAccount) {
      const fresh = accounts.find(a => a.id === selectedAccount.id)
      if (fresh && fresh !== selectedAccount) setSelectedAccount(fresh)
      if (!fresh) setSelectedAccount(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts])

  return (
    <div>
      <SectionHeader
        eyebrow="Cuentas"
        title="Cuentas"
        subtitle="Gestiona tus cuentas de prop firm y capital real."
        right={
          <button onClick={() => setShowNewModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-light">
            <Plus size={16} /> Nueva cuenta
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Capital total gestionado" value={fmt(globalStats.totalCapital)} />
        <StatCard label="P&L agregado" value={`${globalStats.totalPnl >= 0 ? '+' : ''}${fmt(globalStats.totalPnl)}`} positive={globalStats.totalPnl >= 0} />
        <StatCard label="Cuentas activas" value={String(globalStats.active)} />
        <StatCard label="Cuentas funded" value={String(globalStats.funded)} />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <PillTabs tabs={[{ id: 'active', label: 'Activas' }, { id: 'history', label: 'Histórico' }]} active={statusTab} onChange={v => setStatusTab(v as any)} />
          <PillTabs tabs={[{ id: 'accounts', label: 'Por cuenta' }, { id: 'groups', label: 'Por grupo' }]} active={viewMode} onChange={v => setViewMode(v as any)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {INSTRUMENT_FILTERS.map(f => (
            <ChipButton key={f} active={instrumentFilter === f} onClick={() => setInstrumentFilter(f)}>{f}</ChipButton>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-ink-900/40 dark:text-bone-100/40">No hay cuentas en esta vista. Crea una nueva para empezar.</p>
        </Card>
      ) : viewMode === 'accounts' ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(acc => (
            <AccountCard key={acc.id} account={acc} stats={accountsStats[acc.id]} onClick={() => setSelectedAccount(acc)} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(g => (
            <GroupCard key={g.label} group={g} accountsStats={accountsStats} onSelectAccount={setSelectedAccount} />
          ))}
        </div>
      )}

      <NewAccountModal open={showNewModal} onClose={() => setShowNewModal(false)} />
      <AccountDetailModal account={selectedAccount} onClose={() => setSelectedAccount(null)} />
    </div>
  )
}