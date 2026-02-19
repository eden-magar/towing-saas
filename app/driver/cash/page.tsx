'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/app/lib/AuthContext'
import { getDriverByUserId } from '@/app/lib/queries/driver-tasks'
import { 
  getDriverCashBalance, 
  getDriverCashTransactions, 
  createCashTransfer 
} from '@/app/lib/queries/driver-cash'
import { DriverCashTransaction } from '@/app/lib/types'
import { 
  Wallet, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  CheckCircle2, 
  Loader2, 
  Send,
  Clock
} from 'lucide-react'

export default function DriverCashPage() {
  const { user } = useAuth()
  const [driverId, setDriverId] = useState<string | null>(null)
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState<DriverCashTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [transferring, setTransferring] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferNotes, setTransferNotes] = useState('')

  useEffect(() => {
    if (user) loadData()
  }, [user])

  const loadData = async () => {
    if (!user) return
    try {
      const driver = await getDriverByUserId(user.id)
      if (!driver) return
      setDriverId(driver.id)

      const [bal, txs] = await Promise.all([
        getDriverCashBalance(driver.id),
        getDriverCashTransactions(driver.id)
      ])
      setBalance(bal)
      setTransactions(txs)
    } catch (error) {
      console.error('Error loading cash data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTransfer = async () => {
    if (!driverId || !user || balance <= 0) return
    setTransferring(true)
    try {
      await createCashTransfer(driverId, balance, user.id, transferNotes || undefined)
      setShowTransferModal(false)
      setTransferNotes('')
      await loadData()
    } catch (error) {
      console.error('Error creating transfer:', error)
      alert('שגיאה בדיווח העברה')
    } finally {
      setTransferring(false)
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

  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'collection':
        return { label: 'גבייה', icon: ArrowDownCircle, color: 'text-red-500', bg: 'bg-red-50' }
      case 'transfer':
        return { label: 'העברה לחברה', icon: ArrowUpCircle, color: 'text-amber-500', bg: 'bg-amber-50' }
      case 'approval':
        return { label: 'אושר ע״י מנהל', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' }
      default:
        return { label: type, icon: Clock, color: 'text-gray-500', bg: 'bg-gray-50' }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-blue-600 to-blue-700 px-5 pt-6 pb-8">
        <div className="flex items-center gap-2 mb-4">
          <Wallet size={24} className="text-white" />
          <h1 className="text-xl font-bold text-white">הקופה שלי</h1>
        </div>

        {/* Balance Card */}
        <div className="bg-white/15 backdrop-blur rounded-2xl p-5 text-center">
          <p className="text-blue-100 text-sm mb-1">יתרת מזומן</p>
          <p className={`text-4xl font-bold ${balance > 0 ? 'text-white' : 'text-emerald-300'}`}>
            ₪{balance.toLocaleString()}
          </p>
          {balance > 0 && (
            <p className="text-blue-200 text-xs mt-1">יש להעביר לחברה</p>
          )}
        </div>

        {/* Transfer Button */}
        {balance > 0 && (
          <button
            onClick={() => setShowTransferModal(true)}
            className="w-full mt-4 py-3 bg-white text-blue-600 rounded-xl font-bold flex items-center justify-center gap-2"
          >
            <Send size={18} />
            העברתי לחברה
          </button>
        )}
      </div>

      {/* Transactions List */}
      <div className="px-5 pt-4">
        <h2 className="text-lg font-bold text-gray-800 mb-3">היסטוריה</h2>
        {transactions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Wallet size={48} className="mx-auto mb-3 opacity-50" />
            <p>אין עסקאות עדיין</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => {
              const info = getTypeInfo(tx.type)
              const Icon = info.icon
              return (
                <div key={tx.id} className="bg-white rounded-xl p-4 flex items-center gap-3 shadow-sm">
                  <div className={`w-10 h-10 ${info.bg} rounded-full flex items-center justify-center`}>
                    <Icon size={20} className={info.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800">{info.label}</p>
                     <p className="text-xs text-gray-400">
                      {formatDate(tx.created_at)} • {formatTime(tx.created_at)}
                      {(tx as any).order_number && <span className="mr-1">• גרירה #{(tx as any).order_number}{(tx as any).customer_order_number ? ` (${(tx as any).customer_order_number})` : ''}</span>}
                    </p>
                    {tx.notes && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{tx.notes}</p>
                    )}
                  </div>
                  <p className={`font-bold text-lg ${tx.type === 'collection' ? 'text-red-500' : 'text-emerald-500'}`}>
                    {tx.type === 'collection' ? '+' : '-'}₪{Number(tx.amount).toLocaleString()}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="w-full bg-white rounded-t-3xl p-6 pb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-1 text-center">דיווח העברה לחברה</h3>
            <p className="text-gray-500 text-center mb-6">סכום: ₪{balance.toLocaleString()}</p>
            
            <textarea
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
              placeholder="הערות (אופציונלי)..."
              rows={3}
              className="w-full p-3 border border-gray-200 rounded-xl text-right mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />

            <button
              onClick={handleTransfer}
              disabled={transferring}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold mb-3 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {transferring ? <Loader2 size={20} className="animate-spin" /> : <Send size={18} />}
              אשר העברה
            </button>
            <button
              onClick={() => { setShowTransferModal(false); setTransferNotes('') }}
              className="w-full py-3 text-gray-500 font-medium"
            >
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  )
}