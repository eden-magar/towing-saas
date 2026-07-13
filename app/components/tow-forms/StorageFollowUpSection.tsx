'use client'

import type { Dispatch, SetStateAction } from 'react'
import Link from 'next/link'
import { AddressInput } from './routes/AddressInput'
import { PhoneInput } from '../ui/PhoneInput'
import {
  SaveCustomerAddressControl,
  type CustomerAddressPendingDraft,
} from '../customer-addresses/SaveCustomerAddressControl'
import type { AddressData } from '../../lib/google-maps'
import type { CustomerAddress } from '../../lib/types'

const FOLLOW_UP_STATUS_LABELS: Record<string, string> = {
  pending: 'ממתינה',
  assigned: 'שובצה',
  in_progress: 'בביצוע',
  completed: 'הושלמה',
  cancelled: 'בוטלה',
  cancelled_charged: 'בוטל בחיוב',
  quote: 'הצעת מחיר',
}

export type StorageFollowUpSectionProps = {
  editTowId?: string
  storageEligible: boolean
  hasStorageFollowUp: boolean
  setHasStorageFollowUp: (value: boolean) => void
  followUpAddress: AddressData
  setFollowUpAddress: (data: AddressData) => void
  followUpContactName: string
  setFollowUpContactName: (value: string) => void
  followUpContactPhone: string
  setFollowUpContactPhone: (value: string) => void
  inheritCustomerOrderNumber: boolean
  setInheritCustomerOrderNumber: Dispatch<SetStateAction<boolean>>
  followUpChildTowId: string | null
  followUpChildStatus: string | null
  onPinDropOpen: () => void
  variant?: 'compact' | 'labeled'
  showSaveAddressOption?: boolean
  pendingAddress?: CustomerAddressPendingDraft | null
  onConfirmPendingAddress?: (draft: CustomerAddressPendingDraft) => void
  onClearPendingAddress?: () => void
  saveAddressDisabled?: boolean
  /** Saved customer addresses for suggestions (omit when no customer). */
  savedAddresses?: CustomerAddress[]
}

function clearFollowUpFields(
  setFollowUpAddress: (data: AddressData) => void,
  setFollowUpContactName: (v: string) => void,
  setFollowUpContactPhone: (v: string) => void,
  setInheritCustomerOrderNumber: Dispatch<SetStateAction<boolean>>
) {
  setFollowUpAddress({ address: '' })
  setFollowUpContactName('')
  setFollowUpContactPhone('')
  setInheritCustomerOrderNumber(false)
}

export function StorageFollowUpSection({
  editTowId,
  storageEligible,
  hasStorageFollowUp,
  setHasStorageFollowUp,
  followUpAddress,
  setFollowUpAddress,
  followUpContactName,
  setFollowUpContactName,
  followUpContactPhone,
  setFollowUpContactPhone,
  inheritCustomerOrderNumber,
  setInheritCustomerOrderNumber,
  followUpChildTowId,
  followUpChildStatus,
  onPinDropOpen,
  variant = 'compact',
  showSaveAddressOption = false,
  pendingAddress = null,
  onConfirmPendingAddress,
  onClearPendingAddress,
  saveAddressDisabled = false,
  savedAddresses,
}: StorageFollowUpSectionProps) {
  const showSection = storageEligible || (!!editTowId && !!followUpChildTowId)
  if (!showSection) return null

  const childIsLive = !!followUpChildStatus && followUpChildStatus !== 'pending'
  const statusLabel =
    (followUpChildStatus && FOLLOW_UP_STATUS_LABELS[followUpChildStatus]) ||
    followUpChildStatus ||
    ''

  const toggleFollowUp = () => {
    if (childIsLive) return
    const next = !hasStorageFollowUp
    setHasStorageFollowUp(next)
    if (!next) {
      clearFollowUpFields(
        setFollowUpAddress,
        setFollowUpContactName,
        setFollowUpContactPhone,
        setInheritCustomerOrderNumber
      )
    }
  }

  return (
    <div className={variant === 'compact' ? 'pt-2 border-t border-gray-100 space-y-2' : 'mt-3 pt-3 border-t border-gray-200'}>
      {childIsLive && followUpChildTowId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 space-y-1">
          <p>
            גרירת ההמשך כבר{' '}
            <span className="font-semibold">{statusLabel}</span>
            {followUpChildStatus === 'assigned' || followUpChildStatus === 'in_progress'
              ? ' — לא ניתן לערוך מכאן'
              : ''}
          </p>
          <Link
            href={`/dashboard/tows/${followUpChildTowId}`}
            className="inline-flex text-[#0284c7] hover:underline font-medium"
          >
            פתיחת גרירת ההמשך
          </Link>
        </div>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={hasStorageFollowUp}
        disabled={childIsLive}
        onClick={toggleFollowUp}
        className={`flex w-full items-start justify-between gap-3 py-2 text-right ${
          childIsLive ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        }`}
      >
        <span
          aria-hidden
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-all duration-200 ${
            hasStorageFollowUp ? 'bg-[#33d4ff] justify-end' : 'bg-gray-200 justify-start'
          }`}
        >
          <span className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-800">יש המשך לגרירה?</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {childIsLive
              ? 'לא ניתן לכבות את ההמשך לאחר ששובצה'
              : 'צרי גרירה נוספת מהחניון אל יעד חדש'}
          </div>
        </div>
      </button>

      {hasStorageFollowUp && (
        <div className="space-y-2 bg-cyan-50/30 rounded-lg p-3 border border-cyan-100">
          {variant === 'labeled' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">יעד ההמשך</label>
              <AddressInput
                value={followUpAddress}
                onChange={childIsLive ? () => {} : setFollowUpAddress}
                placeholder="כתובת היעד של הגרירה הבאה"
                onPinDropClick={childIsLive ? undefined : onPinDropOpen}
                readOnly={childIsLive}
                savedAddresses={savedAddresses}
              />
            </div>
          ) : (
            <AddressInput
              value={followUpAddress}
              onChange={childIsLive ? () => {} : setFollowUpAddress}
              placeholder="כתובת היעד של הגרירה הבאה"
              onPinDropClick={childIsLive ? undefined : onPinDropOpen}
              readOnly={childIsLive}
              savedAddresses={savedAddresses}
            />
          )}
          {onConfirmPendingAddress && onClearPendingAddress && (
            <SaveCustomerAddressControl
              visible={showSaveAddressOption}
              address={followUpAddress.address}
              pending={pendingAddress}
              onConfirm={onConfirmPendingAddress}
              onClear={onClearPendingAddress}
              disabled={saveAddressDisabled || childIsLive}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {variant === 'labeled' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    שם איש קשר ביעד
                  </label>
                  <input
                    type="text"
                    value={followUpContactName}
                    onChange={(e) => setFollowUpContactName(e.target.value)}
                    placeholder="שם"
                    disabled={childIsLive}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    טלפון איש קשר
                  </label>
                  <PhoneInput
                    value={followUpContactPhone}
                    onChange={(phone) => setFollowUpContactPhone(phone)}
                    placeholder="050-1234567"
                    disabled={childIsLive}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] disabled:bg-gray-100"
                  />
                </div>
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={followUpContactName}
                  onChange={(e) => setFollowUpContactName(e.target.value)}
                  placeholder="שם איש קשר"
                  disabled={childIsLive}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                />
                <PhoneInput
                  value={followUpContactPhone}
                  onChange={(phone) => setFollowUpContactPhone(phone)}
                  placeholder="050-1234567"
                  disabled={childIsLive}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                />
              </>
            )}
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={inheritCustomerOrderNumber}
            disabled={childIsLive}
            onClick={() => !childIsLive && setInheritCustomerOrderNumber((prev) => !prev)}
            className={`flex w-full items-start justify-between gap-3 py-2 text-right ${
              childIsLive ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
            }`}
          >
            <span
              aria-hidden
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-all duration-200 ${
                inheritCustomerOrderNumber ? 'bg-[#33d4ff] justify-end' : 'bg-gray-200 justify-start'
              }`}
            >
              <span className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-800">שמור מס׳ הזמנת לקוח לגרירת ההמשך</div>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
