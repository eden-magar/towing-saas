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
import { supabase } from '../../lib/supabase'

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
      const { data: existing } = await supabase
        .from('driver_cash_transactions')
        .select('id')
        .eq('driver_id', tx.driver_id)
        .eq('amount', tx.amount)
        .eq('type', 'approval')
        .gte('created_at', tx.created_at)
        .maybeSingle()

      if (existing) {
        alert('העברה זו כבר אושרה')
        return
      }

      await approveCashTransfer(tx.driver_id, Number(tx.amount), user.id, 'אישור העברה')
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

  const getBalanceBadge = (balance: number) => {
    if (balance === 0) return { text: '₪0', bg: 'bg-emerald-50', color: 'text-emerald-700' }
    if (balance > 500) return { text: `₪${balance.toLocaleString()}`, bg: 'bg-red-50', color: 'text-red-700' }
    return { text: `₪${balance.toLocaleString()}`, bg: 'bg-amber-50', color: 'text-amber-700' }
  }

  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'collection':
        return { label: 'גבייה', icon: ArrowDownCircle, color: 'text-red-500' }
      case 'transfer':
        return { label: 'העברה (ממתין)', icon: ArrowUpCircle, color: 'text-amber-500' }
      case 'approval':
        return { label: 'אושר', icon: CheckCircle2, color: 'text-emerald-500' }
      default:
        return { label: type, icon: Clock, color: 'text-gray-500' }
    }
  }

  const filteredDrivers = drivers.filter(d => d.driverName.includes(searchQuery))
  const totalCash = drivers.reduce((sum, d) => sum + d.balance, 0)
  const driversWithBalance = drivers.filter(d => d.balance > 0).length
  const approvedAmounts = transactions
  .filter(t => t.type === 'approval')
  .map(t => t.driver_id + '_' + t.amount)

const pendingTransfers = transactions.filter(t => 
  t.type === 'transfer' && 
  !approvedAmounts.includes(t.driver_id + '_' + t.amount)
).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3">
        <Loader2 className="animate-spin text-[#33d4ff]" size={28} />
        <span className="text-gray-500">טוען נתוני קופה...</span>
      </div>
    )
  }

  if (selectedDriver) {
    return (
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSelectedDriver(null); setDriverTransactions([]) }}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">{selectedDriver.driverName}</h1>
              <p className="text-sm text-gray-500">היסטוריית קופה</p>
            </div>
          </div>
          <div className={`px-4 py-2 rounded-xl font-bold text-base ${getBalanceBadge(selectedDriver.balance).bg} ${getBalanceBadge(selectedDriver.balance).color}`}>
            יתרה: {getBalanceBadge(selectedDriver.balance).text}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 text-gray-600 font-medium text-sm">
            <Filter size={15} />
            סינון לפי תאריך
          </button>
          {showFilters && (
            <div className="flex gap-3 mt-3 items-end flex-wrap">
              <div>
                <label className="block text-xs text-gray-500 mb-1">מתאריך</label>
                <DateInput value={filterFrom} onChange={setFilterFrom} className="min-w-[10rem]" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">עד תאריך</label>
                <DateInput value={filterTo} onChange={setFilterTo} className="min-w-[10rem]" />
              </div>
              <button onClick={handleFilterApply} className="bg-[#33d4ff] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#21b8e6] transition-colors">סנן</button>
              <button onClick={() => { setFilterFrom(''); setFilterTo(''); handleFilterApply() }} className="text-gray-400 px-2 py-2 text-sm hover:text-gray-600">נקה</button>
            </div>
          )}
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loadingTransactions ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="animate-spin text-[#33d4ff]" size={24} />
            </div>
          ) : driverTransactions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Wallet size={32} className="mx-auto mb-2 opacity-30" />
              אין עסקאות
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">סוג</th>
                    <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">גרירה</th>
                    <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">לקוח</th>
                    <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">סכום</th>
                    <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">תאריך</th>
                    <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">הערות</th>
                    <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">אושר על ידי</th>
                    <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">פעולה</th>
                  </tr>
                </thead>
                <tbody>
                  {driverTransactions.map((tx) => {
                    const info = getTypeInfo(tx.type)
                    const Icon = info.icon
                    return (
                      <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <Icon size={15} className={info.color} />
                            <span className="font-medium text-gray-700">{info.label}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {(tx as any).order_number
                            ? <span className="text-[#33d4ff] font-medium">#{(tx as any).order_number}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-3.5 text-gray-600">{(tx as any).customer_name || <span className="text-gray-300">—</span>}</td>
                        <td className="px-5 py-3.5">
                          <span className="font-bold text-gray-800">₪{Number(tx.amount).toLocaleString()}</span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs">{formatDate(tx.created_at)} {formatTime(tx.created_at)}</td>
                        <td className="px-5 py-3.5 text-gray-500">{tx.notes || <span className="text-gray-300">—</span>}</td>
                        <td className="px-5 py-3.5">
                          {(tx as any).approved_by_name
                            ? <span className="text-emerald-600 font-medium">{(tx as any).approved_by_name}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          {tx.type === 'transfer' && (
                            <button
                              onClick={() => handleApprove(tx)}
                              disabled={approving === tx.id}
                              className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-emerald-100 disabled:opacity-50 flex items-center gap-1 transition-colors"
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
        <h1 className="text-xl font-bold text-gray-800">קופות נהגים</h1>
        <p className="text-sm text-gray-500 mt-1">ניהול מזומנים שנגבו על ידי נהגים</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#33d4ff]/10 flex items-center justify-center flex-shrink-0">
            <Wallet size={18} className="text-[#33d4ff]" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-800">₪{totalCash.toLocaleString()}</p>
            <p className="text-xs text-gray-500">סה״כ מזומן</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <BarChart2 size={18} className="text-amber-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-800">{driversWithBalance}</p>
            <p className="text-xs text-gray-500">נהגים עם יתרה</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Clock size={18} className="text-blue-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-800">{pendingTransfers}</p>
            <p className="text-xs text-gray-500">העברות ממתינות</p>
          </div>
        </div>
      </div>

      {/* Drivers table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חפש נהג..."
              className="w-full pr-9 pl-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30"
            />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">נהג</th>
              <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">יתרת מזומן</th>
              <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs">פעולה</th>
            </tr>
          </thead>
          <tbody>
            {filteredDrivers.map((driver) => {
              const badge = getBalanceBadge(driver.balance)
              return (
                <tr key={driver.driverId} className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors" onClick={() => handleSelectDriver(driver)}>
                  <td className="px-5 py-3.5 font-medium text-gray-800">{driver.driverName}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex px-3 py-1 rounded-xl text-xs font-bold ${badge.bg} ${badge.color}`}>
                      {badge.text}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-[#33d4ff] text-xs font-medium hover:underline">הצג היסטוריה ←</span>
                  </td>
                </tr>
              )
            })}
            {filteredDrivers.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-12 text-gray-400">
                  <Wallet size={24} className="mx-auto mb-2 opacity-30" />
                  לא נמצאו נהגים
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}