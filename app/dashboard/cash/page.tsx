'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { 
  getAllDriversCashBalances, 
  getCompanyCashTransactions, 
  approveCashTransfer 
} from '../../lib/queries/driver-cash'
import { DriverCashTransaction } from '../../lib/types'
import { DateInput } from '../../components/ui'
import { 
  Wallet, 
  Search, 
  CheckCircle2, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Clock, 
  Loader2,
  Filter,
  ChevronLeft,
  BarChart2
} from 'lucide-react'
interface DriverBalance {
  driverId: string
  driverName: string
  balance: number
}

export default function CashManagementPage() {
  const { companyId, user } = useAuth()
  const [drivers, setDrivers] = useState<DriverBalance[]>([])
  const [transactions, setTransactions] = useState<(DriverCashTransaction & { driver_name?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDriver, setSelectedDriver] = useState<DriverBalance | null>(null)
  const [driverTransactions, setDriverTransactions] = useState<(DriverCashTransaction & { driver_name?: string })[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [approving, setApproving] = useState<string | null>(null)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    if (companyId) loadData()
  }, [companyId])

  const loadData = async () => {
    if (!companyId) return
    try {
      const [balances, txs] = await Promise.all([
        getAllDriversCashBalances(companyId),
        getCompanyCashTransactions(companyId)
      ])
      setDrivers(balances)
      setTransactions(txs)
    } catch (error) {
      console.error('Error loading cash data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadDriverTransactions = async (driverId: string) => {
    if (!companyId) return
    setLoadingTransactions(true)
    try {
      const txs = await getCompanyCashTransactions(companyId, { 
        driverId,
        fromDate: filterFrom || undefined,
        toDate: filterTo || undefined
      })
      setDriverTransactions(txs)
    } catch (error) {
      console.error('Error loading driver transactions:', error)
    } finally {
      setLoadingTransactions(false)
    }
  }

  const handleSelectDriver = async (driver: DriverBalance) => {
    setSelectedDriver(driver)
    await loadDriverTransactions(driver.driverId)
  }

  const handleApprove = async (tx: DriverCashTransaction) => {
    if (!user) return
    if (!confirm(`לאשר העברה של ₪${Number(tx.amount).toLocaleString()}?`)) return
    setApproving(tx.id)
    try {
      // Pairing + idempotency are by transfer id (handled inside approveCashTransfer).
      await approveCashTransfer(tx.driver_id, Number(tx.amount), user.id, tx.id, 'אישור העברה')
      await loadData()
      if (selectedDriver) {
        await loadDriverTransactions(selectedDriver.driverId)
      }
    } catch (error) {
      console.error('Error approving transfer:', error)
      alert('שגיאה באישור ההעברה')
    } finally {
      setApproving(null)
    }
  }

  const handleFilterApply = async () => {
    if (selectedDriver) {
      await loadDriverTransactions(selectedDriver.driverId)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  }

  // Display-only color cue by magnitude (no logic/threshold tie to data writes).
  const balanceTone = (balance: number) => {
    if (balance <= 0) return 'text-gt-text-tertiary'
    if (balance > 500) return 'text-gt-danger'
    return 'text-gt-text-primary'
  }

  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'collection':
        return { label: 'גבייה', icon: ArrowDownCircle, pill: 'bg-blue-50 text-blue-600' }
      case 'transfer':
        return { label: 'העברה (ממתין)', icon: ArrowUpCircle, pill: 'bg-amber-50 text-amber-700' }
      case 'approval':
        return { label: 'אושר', icon: CheckCircle2, pill: 'bg-gt-success-subtle text-gt-success' }
      default:
        return { label: type, icon: Clock, pill: 'bg-gray-100 text-gray-500' }
    }
  }

  const filteredDrivers = drivers.filter(d => d.driverName.includes(searchQuery))
  // Display-only sort: drivers with a balance first (highest at top), zero-balance last.
  const sortedDrivers = [...filteredDrivers].sort((a, b) => b.balance - a.balance)
  const totalCash = drivers.reduce((sum, d) => sum + d.balance, 0)
  const driversWithBalance = drivers.filter(d => d.balance > 0).length
  // Pairing is by transfer id: a transfer is "pending" iff no approval row points to it.
  const approvedTransferIds = new Set(
    transactions
      .filter(t => t.type === 'approval' && t.transfer_id)
      .map(t => t.transfer_id as string)
  )

  const isTransferPending = (t: DriverCashTransaction) =>
    t.type === 'transfer' && !approvedTransferIds.has(t.id)

  const pendingTransfers = transactions.filter(isTransferPending).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3">
        <Loader2 className="animate-spin text-gt-brand" size={28} />
        <span className="text-gt-text-tertiary">טוען נתוני קופה...</span>
      </div>
    )
  }

  if (selectedDriver) {
    return (
      <div>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => { setSelectedDriver(null); setDriverTransactions([]) }}
              aria-label="חזרה לרשימת הנהגים"
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gt-border-subtle text-gt-text-secondary hover:bg-gt-surface-hover hover:border-gt-border-strong transition-colors shrink-0"
            >
              <ChevronLeft size={18} className="rotate-180" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gt-text-primary truncate">{selectedDriver.driverName}</h1>
              <p className="text-sm text-gt-text-tertiary">היסטוריית קופה</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2 px-4 py-2 rounded-xl bg-white border border-gt-border-subtle shadow-sm shrink-0">
            <span className="text-xs text-gt-text-tertiary">יתרה</span>
            <span className={`font-bold text-lg tabular-nums ${balanceTone(selectedDriver.balance)}`}>
              ₪{selectedDriver.balance.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gt-border-subtle shadow-sm p-4 mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-gt-text-secondary font-medium text-sm hover:text-gt-text-primary transition-colors"
          >
            <Filter size={15} />
            סינון לפי תאריך
          </button>
          {showFilters && (
            <div className="flex gap-3 mt-3 items-end flex-wrap">
              <div>
                <label className="block text-xs text-gt-text-tertiary mb-1">מתאריך</label>
                <DateInput value={filterFrom} onChange={setFilterFrom} className="min-w-[10rem]" />
              </div>
              <div>
                <label className="block text-xs text-gt-text-tertiary mb-1">עד תאריך</label>
                <DateInput value={filterTo} onChange={setFilterTo} className="min-w-[10rem]" />
              </div>
              <button
                onClick={handleFilterApply}
                className="bg-gt-brand text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gt-brand-hover transition-colors"
              >
                סנן
              </button>
              <button
                onClick={() => { setFilterFrom(''); setFilterTo(''); handleFilterApply() }}
                className="text-gt-text-tertiary px-2 py-2 text-sm hover:text-gt-text-secondary transition-colors"
              >
                נקה
              </button>
            </div>
          )}
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-2xl border border-gt-border-subtle shadow-sm overflow-hidden">
          {loadingTransactions ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="animate-spin text-gt-brand" size={24} />
            </div>
          ) : driverTransactions.length === 0 ? (
            <div className="text-center py-12 text-gt-text-tertiary">
              <Wallet size={32} className="mx-auto mb-2 opacity-30" />
              אין עסקאות
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gt-surface-subtle/50 border-b border-gt-border-subtle">
                    <th className="text-right px-5 py-3 font-medium text-gt-text-tertiary text-xs">סוג</th>
                    <th className="text-right px-5 py-3 font-medium text-gt-text-tertiary text-xs">גרירה</th>
                    <th className="text-right px-5 py-3 font-medium text-gt-text-tertiary text-xs">לקוח</th>
                    <th className="text-right px-5 py-3 font-medium text-gt-text-tertiary text-xs">סכום</th>
                    <th className="text-right px-5 py-3 font-medium text-gt-text-tertiary text-xs">תאריך</th>
                    <th className="text-right px-5 py-3 font-medium text-gt-text-tertiary text-xs">הערות</th>
                    <th className="text-right px-5 py-3 font-medium text-gt-text-tertiary text-xs">אושר על ידי</th>
                    <th className="text-right px-5 py-3 font-medium text-gt-text-tertiary text-xs">פעולה</th>
                  </tr>
                </thead>
                <tbody>
                  {driverTransactions.map((tx) => {
                    const info = getTypeInfo(tx.type)
                    const Icon = info.icon
                    return (
                      <tr key={tx.id} className="border-b border-gt-border-subtle/60 last:border-0 hover:bg-gt-surface-hover transition-colors">
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${info.pill}`}>
                            <Icon size={13} />
                            {info.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {(tx as any).order_number
                            ? <span className="text-gt-brand-text font-medium">#{(tx as any).order_number}</span>
                            : <span className="text-gt-text-muted">—</span>}
                        </td>
                        <td className="px-5 py-3.5 text-gt-text-secondary">{(tx as any).customer_name || <span className="text-gt-text-muted">—</span>}</td>
                        <td className="px-5 py-3.5">
                          <span className="font-bold text-gt-text-primary tabular-nums">₪{Number(tx.amount).toLocaleString()}</span>
                        </td>
                        <td className="px-5 py-3.5 text-gt-text-tertiary text-xs whitespace-nowrap">{formatDate(tx.created_at)} {formatTime(tx.created_at)}</td>
                        <td className="px-5 py-3.5 text-gt-text-secondary">{tx.notes || <span className="text-gt-text-muted">—</span>}</td>
                        <td className="px-5 py-3.5">
                          {(tx as any).approved_by_name
                            ? <span className="text-gt-success font-medium">{(tx as any).approved_by_name}</span>
                            : <span className="text-gt-text-muted">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          {isTransferPending(tx) && (
                            <button
                              onClick={() => handleApprove(tx)}
                              disabled={approving === tx.id}
                              className="inline-flex items-center gap-1.5 bg-gt-success-subtle text-gt-success border border-gt-success-border px-3 py-1.5 rounded-lg text-xs font-semibold hover:brightness-95 disabled:opacity-50 transition-all"
                            >
                              {approving === tx.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                              אשר
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gt-text-primary">קופות נהגים</h1>
        <p className="text-sm text-gt-text-tertiary mt-1">ניהול מזומנים שנגבו על ידי נהגים</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gt-border-subtle shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gt-brand-subtle flex items-center justify-center shrink-0">
            <Wallet size={18} className="text-gt-brand-text" />
          </div>
          <div>
            <p className="text-xl font-bold text-gt-text-primary tabular-nums">₪{totalCash.toLocaleString()}</p>
            <p className="text-xs text-gt-text-tertiary">סה״כ מזומן</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gt-border-subtle shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gt-surface-subtle flex items-center justify-center shrink-0">
            <BarChart2 size={18} className="text-gt-text-secondary" />
          </div>
          <div>
            <p className="text-xl font-bold text-gt-text-primary tabular-nums">{driversWithBalance}</p>
            <p className="text-xs text-gt-text-tertiary">נהגים עם יתרה</p>
          </div>
        </div>
        {/* Pending transfers — accent only when action is needed (> 0) */}
        <div className={`rounded-2xl border shadow-sm p-4 flex items-center gap-3 transition-colors ${
          pendingTransfers > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gt-border-subtle'
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            pendingTransfers > 0 ? 'bg-amber-100' : 'bg-gt-surface-subtle'
          }`}>
            <Clock size={18} className={pendingTransfers > 0 ? 'text-amber-600' : 'text-gt-text-tertiary'} />
          </div>
          <div>
            <p className={`text-xl font-bold tabular-nums ${pendingTransfers > 0 ? 'text-amber-700' : 'text-gt-text-primary'}`}>
              {pendingTransfers}
            </p>
            <p className={`text-xs ${pendingTransfers > 0 ? 'text-amber-600' : 'text-gt-text-tertiary'}`}>העברות ממתינות</p>
          </div>
        </div>
      </div>

      {/* Drivers list */}
      <div className="bg-white rounded-2xl border border-gt-border-subtle shadow-sm overflow-hidden max-w-[620px] mx-auto">
        <div className="p-4 border-b border-gt-border-subtle">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gt-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חפש נהג..."
              className="w-full pr-9 pl-4 py-2.5 bg-gt-surface-subtle/40 border border-gt-border-subtle rounded-xl text-sm text-gt-text-primary placeholder:text-gt-text-tertiary focus:outline-none focus:bg-white focus:border-gt-brand focus:ring-[3px] focus:ring-gt-brand/15 transition-all"
            />
          </div>
        </div>

        <div className="divide-y divide-gt-border-subtle">
          {sortedDrivers.map((driver) => (
            <button
              key={driver.driverId}
              type="button"
              onClick={() => handleSelectDriver(driver)}
              className="group w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 text-right hover:bg-gt-surface-hover transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <ChevronLeft
                  size={18}
                  className="text-gt-text-muted group-hover:text-gt-text-secondary group-hover:-translate-x-0.5 transition-all shrink-0"
                />
                <div className="w-9 h-9 rounded-full bg-gt-surface-subtle flex items-center justify-center text-sm font-bold text-gt-text-secondary shrink-0">
                  {driver.driverName.trim().charAt(0) || '?'}
                </div>
                <span className="font-medium text-gt-text-primary truncate">{driver.driverName}</span>
              </div>
              <span className={`font-bold text-base sm:text-lg tabular-nums shrink-0 ${balanceTone(driver.balance)}`}>
                ₪{driver.balance.toLocaleString()}
              </span>
            </button>
          ))}
          {sortedDrivers.length === 0 && (
            <div className="text-center py-12 text-gt-text-tertiary">
              <Wallet size={24} className="mx-auto mb-2 opacity-30" />
              לא נמצאו נהגים
            </div>
          )}
        </div>
      </div>
    </div>
  )
}