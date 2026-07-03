'use client'

import { Loader2, Wallet } from 'lucide-react'
import { useTowForm } from '../../../hooks/useTowForm'
import { FormCard } from '../../ui'

type Form = ReturnType<typeof useTowForm>

const PAYMENT_OPTIONS: { value: 'cash' | 'credit' | 'invoice'; label: string }[] = [
  { value: 'cash', label: 'מזומן' },
  { value: 'credit', label: 'אשראי' },
  { value: 'invoice', label: 'חשבונית' },
]

/**
 * Payment + summary + save for single tows on the mobile scroll page — mirrors
 * create/page.tsx Section 9 (תשלום ושמירה).
 */
export function SectionPayment({ form }: { form: Form }) {
  const vehicleModel = form.vehicleData?.data?.model ?? ''

  return (
    <FormCard icon={Wallet} title="תשלום ושמירה">
      <div className="space-y-4">
        <div className="flex gap-2">
          {PAYMENT_OPTIONS.map((opt) => {
            const isActive = form.paymentMethod === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => form.setPaymentMethod(opt.value)}
                className={`flex-1 min-h-[48px] px-3 rounded-xl text-sm ${
                  isActive
                    ? 'bg-gt-brand text-white'
                    : 'bg-white text-gray-700 border border-gray-300 font-medium'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        {form.paymentMethod === 'invoice' && (
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={form.invoiceName}
              onChange={(e) => form.setInvoiceName(e.target.value)}
              placeholder="שם לחשבונית"
              className="flex-1 px-3 h-12 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
            />
            <button
              type="button"
              onClick={() => form.setInvoiceName(form.customerName)}
              className="shrink-0 px-2.5 py-1 text-xs font-medium rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
            >
              כמו לקוח
            </button>
          </div>
        )}

        <div className="p-4 bg-gray-50 rounded-xl text-sm">
          <p className="font-medium mb-1">{form.customerName}</p>
          <p className="text-gray-500 mb-1">{form.customerPhone}</p>
          <p className="text-gray-500 mb-1">
            {form.towDate} {form.towTime}
          </p>
          <p className="text-gray-500 mb-1">
            {form.vehiclePlate}
            {vehicleModel ? ` — ${vehicleModel}` : ''}
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            ₪{form.finalPrice.toFixed(2)}
          </p>
        </div>

        <button
          type="button"
          onClick={form.handleSave}
          disabled={form.saving}
          className="w-full min-h-[48px] py-3 bg-gt-brand text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gt-brand-hover disabled:opacity-50"
        >
          {form.saving ? <Loader2 size={20} className="animate-spin" /> : null}
          שמור גרירה
        </button>
      </div>
    </FormCard>
  )
}
