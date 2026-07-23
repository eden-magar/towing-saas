'use client'

import { useState, useEffect } from 'react'
import { Check, Loader2, Plus, X } from 'lucide-react'
import {
  createCustomerPortalAddress,
  findNearbyPortalAddress,
  shouldOfferSavePortalAddress,
} from '@/app/lib/queries/customer-portal-addresses'
import type { CustomerPortalAddress } from '@/app/lib/types'
import type { AddressData } from '@/app/components/tow-forms/routes/AddressInput'

interface SavePortalAddressControlProps {
  addressData: AddressData
  addresses: CustomerPortalAddress[]
  onAddressesChange: (addresses: CustomerPortalAddress[]) => void
  companyId: string | null
  customerId: string | null
  userId: string | null
  canEdit: boolean
  disabled?: boolean
  className?: string
}

/**
 * Explicit save — prompts for label, writes immediately (portal contacts pattern).
 */
export function SavePortalAddressControl({
  addressData,
  addresses,
  onAddressesChange,
  companyId,
  customerId,
  userId,
  canEdit,
  disabled = false,
  className = '',
}: SavePortalAddressControlProps) {
  const [promptOpen, setPromptOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    setSavedFlash(false)
    setPromptOpen(false)
    setError('')
  }, [addressData.address, addressData.lat, addressData.lng])

  const nearby = findNearbyPortalAddress(addressData.lat, addressData.lng, addresses)
  const offerSave = shouldOfferSavePortalAddress(
    addressData.lat,
    addressData.lng,
    addressData.address,
    addresses,
    canEdit
  )

  if (nearby && !savedFlash) {
    return (
      <p
        className={`text-xs text-gt-text-tertiary ${className}`}
        dir="rtl"
      >
        כבר שמור כ־&quot;{nearby.label}&quot;
      </p>
    )
  }

  if (!offerSave && !savedFlash) {
    return null
  }

  const handleConfirm = async () => {
    if (!companyId || !customerId || !userId) return
    const trimmed = label.trim()
    if (!trimmed) {
      setError('תווית היא שדה חובה')
      return
    }
    if (addressData.lat == null || addressData.lng == null) {
      return
    }

    setSaving(true)
    setError('')
    try {
      const created = await createCustomerPortalAddress(companyId, customerId, userId, {
        label: trimmed,
        address: addressData.address,
        lat: addressData.lat,
        lng: addressData.lng,
        place_id: addressData.placeId ?? null,
      })
      onAddressesChange(
        [...addresses.filter((a) => a.id !== created.id), created].sort((a, b) =>
          a.label.localeCompare(b.label, 'he')
        )
      )
      setPromptOpen(false)
      setLabel('')
      setSavedFlash(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת הכתובת')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={className} dir="rtl">
      <button
        type="button"
        onClick={() => {
          setPromptOpen(true)
          setError('')
          setLabel('')
        }}
        disabled={disabled || saving || savedFlash || !companyId || !customerId || !userId}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          savedFlash
            ? 'bg-[#33d4ff]/15 text-[#1a9bc7] border border-[#33d4ff]/40'
            : 'bg-transparent text-gray-600 border border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
      >
        {saving ? (
          <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden />
        ) : savedFlash ? (
          <Check size={14} className="shrink-0" aria-hidden />
        ) : (
          <Plus size={14} className="shrink-0" aria-hidden />
        )}
        {savedFlash ? 'נשמר ברשימה' : 'שמור לרשימה'}
      </button>

      {promptOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white">
              <h3 className="font-bold text-lg">שמירת כתובת</h3>
              <button
                type="button"
                onClick={() => setPromptOpen(false)}
                className="p-2 hover:bg-white/20 rounded-lg"
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-600 break-words">{addressData.address}</p>
              <div>
                <label className="block text-sm text-gray-600 mb-1">תווית *</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="למשל: מוסך אבי"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  autoFocus
                  disabled={saving}
                />
              </div>
              {error && (
                <p className="text-xs text-gt-danger" role="alert">
                  {error}
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setPromptOpen(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100"
                  disabled={saving}
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 py-2.5 bg-[#33d4ff] text-white rounded-xl font-medium hover:bg-[#21b8e6] disabled:bg-gray-300"
                  disabled={saving || !label.trim()}
                >
                  {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'שמור'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
