'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { 
  getAllDriversCashBalances, 
  getCompanyCashTransactions, 
  approveCashTransfer 
} from '../../lib/queries/driver-cash'
import { DriverCashTransaction } from '../../lib/types'
import { 
  Wallet, 
  Search, 
  CheckCircle2, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Clock, 
  Loader2,
  Filter,
  X,
  ChevronLeft
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
    setApproving(tx.id)
    try {
      await approveCashTransfer(tx.driver_id, Number(tx.amount), user.id, `אישור העברה`)
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
    if (balance === 0) return { text: '₪0', bg: 'bg-emerald-100', color: 'text-emerald-700' }
    if (balance > 500) return { text: `₪${balance.toLocaleString()}`, bg: 'bg-red-100', color: 'text-red-700' }
    return { text: `₪${balance.toLocaleString()}`, bg: 'bg-amber-100', color: 'text-amber-700' }
  }

  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'collection':
        return { label: 'גבייה', icon: ArrowDownCircle, color: 'text-red-500', bg: 'bg-red-50' }
      case 'transfer':
        return { label: 'העברה (ממתין)', icon: ArrowUpCircle, color: 'text-amber-500', bg: 'bg-amber-50' }
      case 'approval':
        return { label: 'אושר', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' }
      default:
        return { label: type, icon: Clock, color: 'text-gray-500', bg: 'bg-gray-50' }
    }
  }

  const filteredDrivers = drivers.filter(d => 
    d.driverName.includes(searchQuery)
  )

  const totalCash = drivers.reduce((sum, d) => sum + d.balance, 0)
  const driversWithBalance = drivers.filter(d => d.balance > 0).length
  const pendingTransfers = transactions.filter(t => t.type === 'transfer').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-500" size={32} />
        <span className="mr-3 text-gray-500">טוען נתוני קופה...</span>
      </div>
    )
  }

  // תצוגת היסטוריה של נהג ספציפי
  if (selectedDriver) {
    return (
      <div>
        <button
          onClick={() => { setSelectedDriver(null); setDriverTransactions([]) }}
          className="flex items-center gap-1 text-blue-600 mb-4 hover:underline"
        >
          <ChevronLeft size={18} />
          חזרה לרשימה
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{selectedDriver.driverName}</h1>
            <p className="text-gray-500">היסטוריית קופה</p>
          </div>
          <div className={`px-4 py-2 rounded-xl font-bold text-lg ${getBalanceBadge(selectedDriver.balance).bg} ${getBalanceBadge(selectedDriver.balance).color}`}>
            יתרה: {getBalanceBadge(selectedDriver.balance).text}
          </div>
        </div>

        {/* סינון תאריכים */}
        <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 text-gray-600 font-medium">
            <Filter size={16} />
            סינון לפי תאריך
          </button>
          {showFilters && (
            <div className="flex gap-3 mt-3 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">מתאריך</label>
                <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">עד תאריך</label>
                <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
              </div>
              <button onClick={handleFilterApply} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">סנן</button>
              <button onClick={() => { setFilterFrom(''); setFilterTo(''); handleFilterApply() }} className="text-gray-500 px-2 py-2 text-sm">נקה</button>
            </div>
          )}
        </div>

        {/* טבלת עסקאות */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loadingTransactions ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="animate-spin text-blue-500" size={24} />
            </div>
          ) : driverTransactions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">אין עסקאות</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">סוג</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">סכום</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">תאריך</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">הערות</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">פעולה</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {driverTransactions.map((tx) => {
                  const info = getTypeInfo(tx.type)
                  const Icon = info.icon
                  return (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Icon size={16} className={info.color} />
                          <span className="text-sm">{info.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold">₪{Number(tx.amount).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(tx.created_at)} {formatTime(tx.created_at)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{tx.notes || '—'}</td>
                      <td className="px-4 py-3">
                        {tx.type === 'transfer' && (
                          <button
                            onClick={() => handleApprove(tx)}
                            disabled={approving === tx.id}
                            className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                          >
                            {approving === tx.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                            אשר
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  // תצוגה ראשית — רשימת נהגים
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">קופות נהגים</h1>
        <p className="text-gray-500">ניהול מזומנים שנגבו על ידי נהגים</p>
      </div>

      {/* סטטיסטיקות */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">סה״כ מזומן בנהגים</p>
          <p className="text-2xl font-bold text-gray-800">₪{totalCash.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">נהגים עם יתרה</p>
          <p className="text-2xl font-bold text-amber-600">{driversWithBalance}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">העברות ממתינות</p>
          <p className="text-2xl font-bold text-blue-600">{pendingTransfers}</p>
        </div>
      </div>

      {/* חיפוש */}
      <div className="bg-white rounded-xl shadow-sm mb-4">
        <div className="p-4 border-b flex gap-3 items-center">
          <div className="flex-1 relative">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חפש נהג..."
              className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        {/* טבלת נהגים */}
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">נהג</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">יתרת מזומן</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">פעולה</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredDrivers.map((driver) => {
              const badge = getBalanceBadge(driver.balance)
              return (
                <tr key={driver.driverId} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleSelectDriver(driver)}>
                  <td className="px-4 py-3 font-medium text-gray-800">{driver.driverName}</td>
                  <td className="px-4 py-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${badge.bg} ${badge.color}`}>
                      {badge.text}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-blue-600 text-sm hover:underline">הצג היסטוריה</button>
                  </td>
                </tr>
              )
            })}
            {filteredDrivers.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-8 text-gray-400">לא נמצאו נהגים</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}