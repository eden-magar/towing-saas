'use client'

import { Building2, Loader2, Search, Tag, TrendingDown, ChevronLeft } from 'lucide-react'

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
  price_per_km_private?: number | null
  price_per_km_motorcycle?: number | null
  price_per_km_heavy?: number | null
  price_per_km_machinery?: number | null
  minimum_price?: number | null
}

interface CustomerSearchResult {
  customer_id: string
  customer_company_id: string
  name: string
  type: string
  phone?: string | null
  discount_percent: number
}

interface CustomerPricingTabProps {
  customers: CustomerPriceList[]
  onEdit: (customer: CustomerPriceList) => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  searchResults: CustomerSearchResult[]
  searchLoading: boolean
  onSelectSearchResult: (customer: CustomerPriceList) => void
}

export function CustomerPricingTab({
  customers,
  onEdit,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  searchLoading,
  onSelectSearchResult,
}: CustomerPricingTabProps) {
  const hasCustomPricing = (customer: CustomerPriceList) =>
    customer.base_price_private || customer.base_price_heavy ||
    customer.base_price_machinery || customer.price_per_km ||
    customer.price_per_km_private || customer.price_per_km_motorcycle ||
    customer.price_per_km_heavy || customer.price_per_km_machinery

  const toCustomerPriceList = (hit: CustomerSearchResult): CustomerPriceList => ({
    id: hit.customer_id,
    customer_company_id: hit.customer_company_id,
    name: hit.name,
    type: hit.type,
    discount_percent: hit.discount_percent,
    price_items: [],
  })

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 space-y-3">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">מחירוני לקוחות</h3>
          <p className="text-xs text-gray-400 mt-0.5">לקוחות עם מחירון מותאם — חפש לקוח נוסף להגדרה</p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="חיפוש לפי שם או טלפון..."
            className="w-full pr-9 pl-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/40 focus:border-[#33d4ff]"
          />
          {searchLoading && (
            <Loader2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
          )}
        </div>
        {searchQuery.trim().length >= 2 && searchResults.length > 0 && (
          <div className="border border-gray-100 rounded-lg divide-y divide-gray-50 max-h-48 overflow-y-auto">
            {searchResults.map((hit) => (
              <button
                key={hit.customer_company_id}
                type="button"
                onClick={() => onSelectSearchResult(toCustomerPriceList(hit))}
                className="w-full text-right px-3 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <p className="text-sm font-medium text-gray-800">{hit.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {hit.type}
                  {hit.phone ? ` · ${hit.phone}` : ''}
                </p>
              </button>
            ))}
          </div>
        )}
        {searchQuery.trim().length >= 2 && !searchLoading && searchResults.length === 0 && (
          <p className="text-xs text-gray-400">לא נמצאו לקוחות</p>
        )}
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Building2 size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">אין לקוחות עם מחירון מותאם</p>
          <p className="text-xs mt-1">חפש לקוח למעלה כדי להגדיר מחירון</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {customers.map((customer) => (
            <div
              key={customer.customer_company_id}
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
