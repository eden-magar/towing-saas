'use client'

import { Building2, Edit2 } from 'lucide-react'

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
}

interface CustomerPricingTabProps {
  customers: CustomerPriceList[]
  onEdit: (customer: CustomerPriceList) => void
}

export function CustomerPricingTab({
  customers,
  onEdit
}: CustomerPricingTabProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Building2 size={20} className="text-indigo-500" />
        <div>
          <h3 className="font-bold text-gray-800">מחירוני לקוחות</h3>
          <p className="text-sm text-gray-500">הנחות ומחירים מותאמים ללקוחות עסקיים</p>
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Building2 size={40} className="mx-auto mb-2 text-gray-300" />
          <p>אין לקוחות עסקיים</p>
          <p className="text-sm">הוסף לקוחות בניהול לקוחות להגדרת מחירון מותאם</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {customers.map((customer) => (
            <div 
              key={customer.id} 
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-[#33d4ff] transition-colors cursor-pointer"
              onClick={() => onEdit(customer)}
            >
              <div className="min-w-0">
                <h4 className="font-medium text-gray-800 truncate">{customer.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 bg-gray-200 rounded text-gray-600">{customer.type}</span>
                  {customer.discount_percent > 0 && (
                    <span className="text-xs text-emerald-600 font-medium">
                      {customer.discount_percent}% הנחה
                    </span>
                  )}
                  {customer.price_items.length > 0 && (
                    <span className="text-xs text-blue-600">
                      {customer.price_items.length} מחירים
                    </span>
                  )}
                </div>
              </div>
              <Edit2 size={16} className="text-gray-400 flex-shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}