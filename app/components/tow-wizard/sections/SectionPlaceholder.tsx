'use client'

import { Hammer } from 'lucide-react'
import { FormCard } from '../../ui'

const REMAINING = ['גרר ונהג', 'תשלום ושמירה']

/**
 * Placeholder card for downstream sections (driver/contacts, payment/save).
 * Visually locked until quoteApproved unlocks the gate (opacity handled by parent).
 */
export function SectionPlaceholder({ quoteApproved }: { quoteApproved: boolean }) {
  return (
    <FormCard icon={Hammer} title="המשך הטופס">
      <div className="text-center py-6">
        <p className="text-sm text-gray-500 mb-3">
          {quoteApproved
            ? 'שלבים אלו בבנייה — בקרוב'
            : 'יש לאשר את הצעת המחיר כדי להמשיך'}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {REMAINING.map((label) => (
            <span
              key={label}
              className="text-xs text-gray-500 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-lg"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </FormCard>
  )
}
