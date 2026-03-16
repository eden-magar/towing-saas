'use client'

import { Building2, Edit2, Tag, TrendingDown, ChevronLeft } from 'lucide-react'

interface CustomerPriceItem {
  id: string
  label: string
  price: number
}

interface CustomerPriceList {
  id: string
  customer_company_id: string
  name: string
  type: string
  discount_percent: number
  price_items: CustomerPriceItem[]
  base_price_private?: number | null
  base_price_motorcycle?: number | null
  base_price_heavy?: number | null
  base_price_machinery?: number | null
  price_per_km?: number | null
  minimum_price?: number | null
}

interface CustomerPricingTabProps {
  customers: CustomerPriceList[]
  onEdit: (customer: CustomerPriceList) => void
}

export function CustomerPricingTab({ customers, onEdit }: CustomerPricingTabProps) {
  const hasCustomPricing = (customer: CustomerPriceList) =>
    customer.base_price_private || customer.base_price_heavy ||
    customer.base_price_machinery || customer.price_per_km

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800 text-sm">מחירוני לקוחות</h3>
        <p className="text-xs text-gray-400 mt-0.5">מחירים ותנאים מותאמים ללקוחות עסקיים</p>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Building2 size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">אין לקוחות עסקיים</p>
          <p className="text-xs mt-1">הוסף לקוחות בניהול לקוחות להגדרת מחירון מותאם</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {customers.map((customer) => (
            <div
              key={customer.id}
              onClick={() => onEdit(customer)}
              className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50 cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Building2 size={15} className="text-gray-500" />
                </div>
                <div>
                  <p className="font-medium text-gray-800 text-sm">{customer.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{customer.type}</span>
                    {customer.discount_percent > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-emerald-600 font-medium">
                        <TrendingDown size={11} />
                        {customer.discount_percent}% הנחה
                      </span>
                    )}
                    {customer.price_items.length > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-blue-500">
                        <Tag size={11} />
                        {customer.price_items.length} מחירים קבועים
                      </span>
                    )}
                    {hasCustomPricing(customer) && (
                      <span className="text-xs text-purple-500 font-medium">מחירון מותאם</span>
                    )}
                  </div>
                </div>
              </div>
              <ChevronLeft size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}