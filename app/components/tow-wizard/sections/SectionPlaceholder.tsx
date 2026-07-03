'use client'

import { Hammer } from 'lucide-react'
import { FormCard } from '../../ui'

const REMAINING = ['רכב ומסלול', 'מחיר', 'הצעת מחיר', 'תשלום ושמירה']

/**
 * Placeholder card for the not-yet-built sections (vehicle/route, pricing,
 * quote, payment/save). Rendered at the bottom of the mobile scroll page so the
 * flow is complete-feeling while the remaining sections are built.
 */
export function SectionPlaceholder() {
  return (
    <FormCard icon={Hammer} title="המשך הטופס">
      <div className="text-center py-6">
        <p className="text-sm text-gray-500 mb-3">שלבים אלו בבנייה — בקרוב</p>
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
