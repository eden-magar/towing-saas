'use client'

import { Banknote, CreditCard, FileText } from 'lucide-react'

type PaymentMethod = 'cash' | 'credit' | 'invoice'

interface PaymentSectionProps {
  sectionNumber: number
  invoiceName: string
  onInvoiceNameChange: (name: string) => void
  customerName: string
  paymentMethod: PaymentMethod
  onPaymentMethodChange: (method: PaymentMethod) => void
  creditCardNumber: string
  creditCardExpiry: string
  creditCardCvv: string
  creditCardId: string
  onCreditCardNumberChange: (value: string) => void
  onCreditCardExpiryChange: (value: string) => void
  onCreditCardCvvChange: (value: string) => void
  onCreditCardIdChange: (value: string) => void
}

export function PaymentSection({
  sectionNumber,
  invoiceName,
  onInvoiceNameChange,
  customerName,
  paymentMethod,
  onPaymentMethodChange,
  creditCardNumber,
  creditCardExpiry,
  creditCardCvv,
  creditCardId,
  onCreditCardNumberChange,
  onCreditCardExpiryChange,
  onCreditCardCvvChange,
  onCreditCardIdChange
}: PaymentSectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-5 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
        <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
          <span className="w-6 h-6 bg-[#33d4ff] text-white rounded-full flex items-center justify-center text-sm">
            {sectionNumber}
          </span>
          תשלום
        </h2>
      </div>
      <div className="p-4 sm:p-5 space-y-4">
        {/* שם לחשבונית */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">שם לחשבונית</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={invoiceName}
              onChange={(e) => onInvoiceNameChange(e.target.value)}
              placeholder="שם לחשבונית"
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
            />
            <button
              onClick={() => onInvoiceNameChange(customerName)}
              className="px-3 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs hover:bg-gray-200 whitespace-nowrap"
            >
              זהה ללקוח
            </button>
          </div>
        </div>

        {/* אמצעי תשלום */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">אמצעי תשלום</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onPaymentMethodChange('cash')}
              className={`py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
                paymentMethod === 'cash' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Banknote size={18} />
              <span>מזומן</span>
            </button>
            <button
              onClick={() => onPaymentMethodChange('credit')}
              className={`py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
                paymentMethod === 'credit' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <CreditCard size={18} />
              <span>אשראי</span>
            </button>
            <button
              onClick={() => onPaymentMethodChange('invoice')}
              className={`py-3 px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
                paymentMethod === 'invoice' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <FileText size={18} />
              <span>חשבונית</span>
            </button>
          </div>
        </div>

        {/* פרטי כרטיס אשראי */}
        {paymentMethod === 'credit' && (
          <div className="p-4 bg-gray-50 rounded-xl space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">מספר כרטיס</label>
              <input
                type="text"
                value={creditCardNumber}
                onChange={(e) => onCreditCardNumberChange(e.target.value)}
                placeholder="0000-0000-0000-0000"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-mono"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תוקף</label>
                <input
                  type="text"
                  value={creditCardExpiry}
                  onChange={(e) => onCreditCardExpiryChange(e.target.value)}
                  placeholder="MM/YY"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                <input
                  type="text"
                  value={creditCardCvv}
                  onChange={(e) => onCreditCardCvvChange(e.target.value)}
                  placeholder="000"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ת.ז.</label>
                <input
                  type="text"
                  value={creditCardId}
                  onChange={(e) => onCreditCardIdChange(e.target.value)}
                  placeholder="123456789"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white font-mono"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
