'use client'

import { useState } from 'react'
import { 
  FileText, 
  Check, 
  Loader2
} from 'lucide-react'

interface StepDeliveryProps {
  customer: { name: string; phone: string | null } | null
  onComplete: (recipientName: string, recipientPhone: string) => Promise<void>
}

export default function StepDelivery({
  customer,
  onComplete
}: StepDeliveryProps) {
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [sameAsCustomer, setSameAsCustomer] = useState(false)
  const [loading, setLoading] = useState(false)

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
    if (!recipientName.trim()) {
      alert('יש להזין שם מקבל')
      return
    }

    setLoading(true)
    try {
      await onComplete(recipientName.trim(), recipientPhone.trim())
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = recipientName.trim().length > 0

  return (
    <div className="flex flex-col min-h-[calc(100vh-70px)]">
      {/* Header Info */}
      <div className="px-5 pt-2 pb-6 text-white text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <FileText size={24} />
          <h1 className="text-2xl font-bold">פרטי מסירה</h1>
        </div>
        <p className="text-white/80">למי נמסר הרכב?</p>
      </div>

      {/* Content Card */}
      <div className="flex-1 bg-white rounded-t-3xl px-5 pt-8 pb-32">
        {/* שם מלא */}
        <div className="mb-6">
          <label className="block text-sm text-gray-500 mb-2 text-right">שם מלא</label>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="הכנס שם"
            className="w-full p-4 border border-gray-200 rounded-xl text-right text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* טלפון */}
        <div className="mb-6">
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
          <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={sameAsCustomer}
              onChange={(e) => handleSameAsCustomer(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-gray-700">זהה למזמין</span>
          </label>
        )}
      </div>

      {/* Bottom Action - Fixed */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-8">
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
              סיים גרירה
            </>
          )}
        </button>
      </div>
    </div>
  )
}