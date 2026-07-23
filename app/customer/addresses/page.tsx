'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/app/lib/AuthContext'
import { getCustomerForUser } from '@/app/lib/queries/customer-portal'
import {
  canEditPortalContacts,
  createCustomerPortalAddress,
  deleteCustomerPortalAddress,
  getPortalMembershipRole,
  listCustomerPortalAddresses,
  PORTAL_ADDRESS_COORDS_REQUIRED_MESSAGE,
  updateCustomerPortalAddress,
  type PortalCustomerUserRole,
} from '@/app/lib/queries/customer-portal-addresses'
import type { CustomerPortalAddress } from '@/app/lib/types'
import {
  AddressInput,
  type AddressData,
} from '@/app/components/tow-forms/routes/AddressInput'
import { PinDropModal } from '@/app/components/tow-forms/shared/PinDropModal'
import {
  MapPinned,
  Pencil,
  Plus,
  Trash2,
  X,
  Loader2,
} from 'lucide-react'

type AddressFormState = {
  label: string
  addressData: AddressData
}

const emptyAddressData = (): AddressData => ({ address: '' })

const emptyForm = (): AddressFormState => ({
  label: '',
  addressData: emptyAddressData(),
})

function hasCoords(data: AddressData): boolean {
  return (
    data.lat != null &&
    data.lng != null &&
    Number.isFinite(data.lat) &&
    Number.isFinite(data.lng) &&
    !(data.lat === 0 && data.lng === 0)
  )
}

export default function CustomerAddressesPage() {
  const { user, loading: authLoading } = useAuth()
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [membershipRole, setMembershipRole] = useState<PortalCustomerUserRole | null>(null)
  const [addresses, setAddresses] = useState<CustomerPortalAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AddressFormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [pinDropOpen, setPinDropOpen] = useState(false)

  const canEdit = canEditPortalContacts(membershipRole)
  const coordsReady = hasCoords(form.addressData)
  const canSubmit =
    canEdit &&
    form.label.trim().length > 0 &&
    form.addressData.address.trim().length > 0 &&
    coordsReady

  const loadAddresses = useCallback(async (cid: string) => {
    const rows = await listCustomerPortalAddresses(cid)
    setAddresses(rows)
  }, [])

  useEffect(() => {
    if (authLoading || !user) return

    const load = async () => {
      const info = await getCustomerForUser(user.id)
      if (!info) {
        setLoading(false)
        return
      }

      const role = await getPortalMembershipRole(user.id, info.customerId)
      setCustomerId(info.customerId)
      setCompanyId(info.companyId)
      setMembershipRole(role)

      await loadAddresses(info.customerId)
      setLoading(false)
    }

    load()
  }, [user, authLoading, loadAddresses])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm())
    setError('')
    setPinDropOpen(false)
    setShowForm(true)
  }

  const openEdit = (row: CustomerPortalAddress) => {
    setEditingId(row.id)
    setForm({
      label: row.label,
      addressData: {
        address: row.address,
        placeId: row.place_id ?? undefined,
        lat: row.lat,
        lng: row.lng,
      },
    })
    setError('')
    setPinDropOpen(false)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setPinDropOpen(false)
    setError('')
    setForm(emptyForm())
  }

  const handleSubmit = async () => {
    if (!canEdit || !companyId || !customerId || !user || !canSubmit) return

    setSaving(true)
    setError('')
    try {
      const payload = {
        label: form.label,
        address: form.addressData.address,
        lat: form.addressData.lat!,
        lng: form.addressData.lng!,
        place_id: form.addressData.placeId ?? null,
      }

      if (editingId) {
        await updateCustomerPortalAddress(companyId, customerId, editingId, payload)
      } else {
        await createCustomerPortalAddress(companyId, customerId, user.id, payload)
      }
      await loadAddresses(customerId)
      closeForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת הכתובת')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (addressId: string) => {
    if (!canEdit || !companyId || !customerId) return
    try {
      await deleteCustomerPortalAddress(companyId, customerId, addressId)
      setDeleteConfirmId(null)
      await loadAddresses(customerId)
    } catch (err) {
      console.error('Error deleting portal address:', err)
      setError(err instanceof Error ? err.message : 'שגיאה במחיקת הכתובת')
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!customerId) {
    return null
  }

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">כתובות שמורות</h1>
        <p className="text-sm text-gray-500 mt-1">
          רשימה משותפת לכל משתמשי הפורטל של הארגון
        </p>
      </div>

      <div className="flex justify-between items-center gap-3">
        <p className="text-sm text-gray-500">
          {canEdit
            ? 'ניתן להוסיף, לערוך ולמחוק כתובות למילוי מהיר בטופסי הזמנה'
            : 'צפייה ברשימה בלבד — אין הרשאת עריכה'}
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 bg-[#33d4ff] text-white px-4 py-2.5 rounded-xl hover:bg-[#21b8e6] transition-colors font-medium text-sm shrink-0"
          >
            <Plus size={18} />
            הוסף כתובת
          </button>
        )}
      </div>

      {error && !showForm && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {addresses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <MapPinned size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-1">אין כתובות שמורות</p>
          <p className="text-sm text-gray-400">
            {canEdit
              ? 'הוסיפו כתובות כדי למלא אותן במהירות בטופסי הזמנה'
              : 'כשיוסיפו כתובות, הן יופיעו כאן'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {addresses.map((row) => (
              <div key={row.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-medium text-gray-800">{row.label}</span>
                    <p className="text-sm text-gray-500 mt-0.5 break-words">{row.address}</p>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="עריכה"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(row.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="מחיקה"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && canEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
          <div className="bg-white w-full lg:max-w-md lg:rounded-2xl lg:mx-4 overflow-hidden rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white sticky top-0 z-10">
              <h2 className="font-bold text-lg">
                {editingId ? 'עריכת כתובת' : 'הוספת כתובת'}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-600 mb-1">תווית *</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="למשל: מוסך אבי"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">כתובת *</label>
                <AddressInput
                  hideLabel
                  value={form.addressData}
                  onChange={(data: AddressData) =>
                    setForm((prev) => ({ ...prev, addressData: data }))
                  }
                  placeholder="התחילו להקליד, הניחו סיכה, או הדביקו קישור"
                  onPinDropClick={() => setPinDropOpen(true)}
                />
                {!coordsReady && form.addressData.address.trim().length > 0 && (
                  <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {PORTAL_ADDRESS_COORDS_REQUIRED_MESSAGE}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit || saving}
                  className="flex-1 py-3 bg-[#33d4ff] text-white rounded-xl hover:bg-[#21b8e6] disabled:bg-gray-300 transition-colors font-medium"
                >
                  {saving ? (
                    <Loader2 size={18} className="animate-spin mx-auto" />
                  ) : editingId ? (
                    'שמור'
                  ) : (
                    'הוסף'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PinDropModal
        isOpen={pinDropOpen}
        onClose={() => setPinDropOpen(false)}
        onConfirm={(data) => {
          setForm((prev) => ({ ...prev, addressData: data }))
          setPinDropOpen(false)
        }}
        initialAddress={form.addressData.address.trim() ? form.addressData : undefined}
        title="בחירת מיקום לכתובת שמורה"
      />

      {deleteConfirmId && canEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} className="text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">מחיקת כתובת</h2>
              <p className="text-gray-600">הכתובת תוסר מהרשימה המשותפת. להמשיך?</p>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-colors"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                מחק
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
