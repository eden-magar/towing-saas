'use client'

import { useEffect } from 'react'
import { FixedPriceItem, CustomerWithPricing } from '../../../lib/queries/price-lists'

// ==================== Types ====================

export interface PriceItem {
  id: string
  label: string
  price: number
}

export interface DistanceResult {
  distanceKm: number
  durationMinutes: number
}

interface PriceSelectorProps {
  priceMode: 'recommended' | 'recommended_customer' | 'fixed' | 'customer' | 'custom'
  setPriceMode: (mode: 'recommended' | 'recommended_customer' | 'fixed' | 'customer' | 'custom') => void
  selectedPriceItem: PriceItem | null
  setSelectedPriceItem: (item: PriceItem | null) => void
  customPrice: string
  setCustomPrice: (price: string) => void
  recommendedPrice: number
  distance: DistanceResult | null
  basePriceList: any
  fixedPriceItems: FixedPriceItem[]
  selectedCustomerPricing: CustomerWithPricing | null
  showRecommended?: boolean
  customPriceIncludesVat?: boolean
  setCustomPriceIncludesVat?: (v: boolean) => void
}

// ==================== Component ====================

export function PriceSelector({
  priceMode,
  setPriceMode,
  selectedPriceItem,
  setSelectedPriceItem,
  customPrice,
  setCustomPrice,
  recommendedPrice,
  distance,
  basePriceList,
  fixedPriceItems,
  selectedCustomerPricing,
  showRecommended = true,
  customPriceIncludesVat = true,
  setCustomPriceIncludesVat,
}: PriceSelectorProps) {
  const hasCustomerPricing = selectedCustomerPricing && selectedCustomerPricing.price_items.length > 0
  const hasFixedPrices = fixedPriceItems.length > 0

  // If recommended is hidden and priceMode is recommended, switch to another mode
  useEffect(() => {
    if (!showRecommended && priceMode === 'recommended') {
      if (hasCustomerPricing) {
        setPriceMode('customer')
      } else if (hasFixedPrices) {
        setPriceMode('fixed')
      } else {
        setPriceMode('custom')
      }
    }
  }, [showRecommended, priceMode, hasCustomerPricing, hasFixedPrices, setPriceMode])

  return (
    <div className="space-y-3">
      {/* מחיר מומלץ - only show for single tow */}
      {showRecommended && (
        <button
          onClick={() => {
            setPriceMode('recommended'); setSelectedPriceItem(null); setCustomPrice('')
          }}
          className={`w-full p-4 rounded-xl border-2 transition-all text-right ${
            priceMode === 'recommended' ? 'border-[#33d4ff] bg-[#33d4ff]/5' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                priceMode === 'recommended' ? 'bg-[#33d4ff] text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                📊
              </div>
              <div>
                <p className={`font-medium ${priceMode === 'recommended' ? 'text-[#33d4ff]' : 'text-gray-700'}`}>מחיר מומלץ</p>
                <p className="text-xs text-gray-500">
                  {distance ? `${distance.distanceKm} ק״מ × ₪${basePriceList?.price_per_km || 12}` : 'חישוב אוטומטי לפי מחירון'}
                </p>
              </div>
            </div>
            <span className={`text-xl font-bold ${priceMode === 'recommended' ? 'text-[#33d4ff]' : 'text-gray-800'}`}>
              ₪{Number(recommendedPrice).toFixed(2)}
            </span>
          </div>
        </button>
      )}

      {/* מחיר מומלץ לפי מחירון לקוח */}
       {showRecommended && selectedCustomerPricing?.price_list && (
        <button
          onClick={() => {
            setPriceMode('recommended_customer'); setSelectedPriceItem(null); setCustomPrice('')
          }}
          className={`w-full p-4 rounded-xl border-2 transition-all text-right ${
            priceMode === 'recommended_customer' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                priceMode === 'recommended_customer' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                🏷️
              </div>
              <div>
                <p className={`font-medium ${priceMode === 'recommended_customer' ? 'text-purple-700' : 'text-gray-700'}`}>
                  מחיר מומלץ — מחירון {selectedCustomerPricing.customer?.name}
                </p>
                <p className="text-xs text-gray-500">
                  {distance ? `${distance.distanceKm} ק״מ × ₪${selectedCustomerPricing.price_list?.price_per_km || basePriceList?.price_per_km || 12}` : 'חישוב לפי מחירון הלקוח'}
                </p>
              </div>
            </div>
            <span className={`text-xl font-bold ${priceMode === 'recommended_customer' ? 'text-purple-700' : 'text-gray-800'}`}>
              ₪{Number(recommendedPrice).toFixed(2)}
            </span>
          </div>
        </button>
      )}

      {/* מחירון לקוח - show first if customer is selected */}
      {hasCustomerPricing && (
        <div className={`rounded-xl border-2 transition-all overflow-hidden ${priceMode === 'customer' ? 'border-purple-500' : 'border-gray-200'}`}>
          <button
            onClick={() => {
              setPriceMode('customer'); setSelectedPriceItem(null); setCustomPrice('')
            }}
            className={`w-full p-4 text-right ${priceMode === 'customer' ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${priceMode === 'customer' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                🏷️
              </div>
              <div>
                <p className={`font-medium ${priceMode === 'customer' ? 'text-purple-700' : 'text-gray-700'}`}>
                  מחירון {selectedCustomerPricing?.customer?.name}
                </p>
                <p className="text-xs text-gray-500">
                  מחירון מותאם ללקוח
                  {(selectedCustomerPricing?.discount_percent ?? 0) > 0 && (
                    <span className="mr-2 text-purple-600">• הנחה {selectedCustomerPricing?.discount_percent}%</span>
                  )}
                </p>
              </div>
            </div>
          </button>
          
          {priceMode === 'customer' && selectedCustomerPricing && (
            <div className="p-3 pt-0 space-y-2">
              {selectedCustomerPricing.price_items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedPriceItem({ id: item.id, label: item.label, price: item.price })}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                    selectedPriceItem?.id === item.id ? 'border-purple-500 bg-purple-100' : 'border-gray-200 bg-white hover:border-purple-300'
                  }`}
                >
                  <span className={`font-medium ${selectedPriceItem?.id === item.id ? 'text-purple-700' : 'text-gray-700'}`}>{item.label}</span>
                  <span className={`font-bold ${selectedPriceItem?.id === item.id ? 'text-purple-700' : 'text-gray-800'}`}>₪{item.price}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* מחירון כללי */}
      {hasFixedPrices && (
        <div className={`rounded-xl border-2 transition-all overflow-hidden ${priceMode === 'fixed' ? 'border-emerald-500' : 'border-gray-200'}`}>
          <button
            onClick={() => {
              setPriceMode('fixed'); setSelectedPriceItem(null); setCustomPrice('')
            }}
            className={`w-full p-4 text-right ${priceMode === 'fixed' ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${priceMode === 'fixed' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                📋
              </div>
              <div>
                <p className={`font-medium ${priceMode === 'fixed' ? 'text-emerald-700' : 'text-gray-700'}`}>מחירון כללי</p>
                <p className="text-xs text-gray-500">תעריפים קבועים</p>
              </div>
            </div>
          </button>
          
          {priceMode === 'fixed' && (
            <div className="p-3 pt-0 space-y-2">
              {fixedPriceItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedPriceItem({ id: item.id, label: item.label, price: item.price })}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                    selectedPriceItem?.id === item.id ? 'border-emerald-500 bg-emerald-100' : 'border-gray-200 bg-white hover:border-emerald-300'
                  }`}
                >
                  <div className="text-right">
                    <span className={`font-medium ${selectedPriceItem?.id === item.id ? 'text-emerald-700' : 'text-gray-700'}`}>{item.label}</span>
                    {item.description && <p className="text-xs text-gray-500">{item.description}</p>}
                  </div>
                  <span className={`font-bold ${selectedPriceItem?.id === item.id ? 'text-emerald-700' : 'text-gray-800'}`}>₪{item.price}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* מחיר ידני */}
      <div className={`rounded-xl border-2 transition-all overflow-hidden ${priceMode === 'custom' ? 'border-amber-500' : 'border-gray-200'}`}>
        <button
          onClick={() => {
            setPriceMode('custom'); setSelectedPriceItem(null)
          }}
          className={`w-full p-4 text-right ${priceMode === 'custom' ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${priceMode === 'custom' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
              ✏️
            </div>
            <div>
              <p className={`font-medium ${priceMode === 'custom' ? 'text-amber-700' : 'text-gray-700'}`}>מחיר ידני</p>
              <p className="text-xs text-gray-500">הזן מחיר אחר</p>
            </div>
          </div>
        </button>
        
        {priceMode === 'custom' && (
          <div className="p-3 pt-0 space-y-2">
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">₪</span>
              <input
                type="number"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder="הזן מחיר"
                className="w-full pr-8 pl-4 py-3 border border-amber-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white font-medium text-lg"
                autoFocus
              />
            </div>
            <button
              onClick={() => setCustomPriceIncludesVat?.(!customPriceIncludesVat)}
              className="flex items-center gap-2 py-1"
            >
              <div className={`relative w-10 h-5 rounded-full transition-colors ${customPriceIncludesVat ? 'bg-amber-500' : 'bg-gray-300'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${customPriceIncludesVat ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-gray-600">כולל מע״מ</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
