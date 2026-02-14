'use client'

import { useState } from 'react'
import { 
  FileText, 
  Check, 
  Loader2,
  MessageSquare,
  Package
} from 'lucide-react'

interface StepDeliveryProps {
  pointType: 'pickup' | 'dropoff'
  customer: { name: string; phone: string | null } | null
  onComplete: (recipientName: string, recipientPhone: string, notes?: string, cashCollected?: number) => Promise<void>
  isLastPoint: boolean
}

export default function StepDelivery({
  pointType,
  customer,
  onComplete,
  isLastPoint
}: StepDeliveryProps) {
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [sameAsCustomer, setSameAsCustomer] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cashReceived, setCashReceived] = useState(false)
  const [cashAmount, setCashAmount] = useState('')

  const isPickup = pointType === 'pickup'

  // העתקה מהלקוח
  const handleSameAsCustomer = (checked: boolean) => {
    setSameAsCustomer(checked)
    if (checked && customer) {
      setRecipientName(customer.name || '')
      setRecipientPhone(customer.phone || '')
    } else {
      setRecipientName('')
      setRecipientPhone('')
    }
  }

  // שליחה
  const handleSubmit = async () => {
    // בפריקה חובה שם מקבל
    if (!isPickup && !recipientName.trim()) {
      alert('יש להזין שם מקבל')
      return
    }

    setLoading(true)
    try {
      await onComplete(
        recipientName.trim(), 
        recipientPhone.trim(),
        notes.trim() || undefined,
        cashReceived && cashAmount ? Number(cashAmount) : undefined
      )
    } finally {
      setLoading(false)
    }
  }

  // באיסוף תמיד אפשר להמשיך, בפריקה צריך שם
  const canSubmit = isPickup || recipientName.trim().length > 0

  return (
    <div className="flex flex-col min-h-[calc(100vh-70px)]">
      {/* Header Info */}
      <div className="px-5 pt-2 pb-6 text-white text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          {isPickup ? <Package size={24} /> : <FileText size={24} />}
          <h1 className="text-2xl font-bold">
            {isPickup ? 'סיום העמסה' : 'פרטי מסירה'}
          </h1>
        </div>
        <p className="text-white/80">
          {isPickup ? 'הרכב הועמס בהצלחה' : 'למי נמסר הרכב?'}
        </p>
      </div>

      {/* Content Card */}
      <div className="flex-1 bg-white rounded-t-3xl px-5 pt-6 pb-40">
        {isLastPoint && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <label className="flex items-center justify-between cursor-pointer mb-3">
              <span className="font-medium text-gray-800">💰 התקבל מזומן?</span>
              <div
                onClick={() => setCashReceived(!cashReceived)}
                className={`w-12 h-7 rounded-full transition-colors relative ${cashReceived ? 'bg-amber-500' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${cashReceived ? 'right-0.5' : 'right-[22px]'}`} />
              </div>
            </label>
            {cashReceived && (
              <div>
                <label className="block text-sm text-gray-500 mb-1 text-right">סכום שנגבה (₪)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder="0"
                  className="w-full p-3 border border-amber-300 rounded-xl text-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            )}
          </div>
        )}

        {/* פרטי מקבל - רק בפריקה */}
        {!isPickup && (
          <>
            {/* שם מלא */}
            <div className="mb-4">
              <label className="block text-sm text-gray-500 mb-2 text-right">
                שם מקבל <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="הכנס שם"
                className="w-full p-4 border border-gray-200 rounded-xl text-right text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* טלפון */}
            <div className="mb-4">
              <label className="block text-sm text-gray-500 mb-2 text-right">טלפון</label>
              <input
                type="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="050-0000000"
                className="w-full p-4 border border-gray-200 rounded-xl text-right text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                dir="ltr"
              />
            </div>

            {/* זהה למזמין */}
            {customer && (
              <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer mb-6">
                <input
                  type="checkbox"
                  checked={sameAsCustomer}
                  onChange={(e) => handleSameAsCustomer(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-gray-700">זהה למזמין ({customer.name})</span>
              </label>
            )}
          </>
        )}

        {/* הערות - תמיד מוצג */}
        <div className="mb-6">
          <label className="block text-sm text-gray-500 mb-2 text-right flex items-center gap-2 justify-end">
            <span>הערות (אופציונלי)</span>
            <MessageSquare size={16} />
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isPickup ? 'הערות לגבי האיסוף...' : 'הערות לגבי המסירה...'}
            rows={3}
            className="w-full p-4 border border-gray-200 rounded-xl text-right text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
        </div>

        {/* הודעה באיסוף */}
        {isPickup && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <p className="text-blue-700 text-sm">
              ✓ התמונות נשמרו בהצלחה
            </p>
          </div>
        )}
      </div>

      {/* Bottom Action - Fixed */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-32">
        <button
          onClick={handleSubmit}
          disabled={loading || !canSubmit}
          className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={22} className="animate-spin" />
          ) : (
            <>
              <Check size={22} />
              {isPickup ? 'המשך לנקודה הבאה' : 'סיים גרירה'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}