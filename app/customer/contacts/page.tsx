'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/app/lib/AuthContext'
import { getCustomerForUser } from '@/app/lib/queries/customer-portal'
import {
  canEditPortalContacts,
  completeCustomerPortalContactPhone,
  createCustomerPortalContact,
  deleteCustomerPortalContact,
  getPortalMembershipRole,
  listCustomerPortalContacts,
  updateCustomerPortalContact,
  type PortalCustomerUserRole,
} from '@/app/lib/queries/customer-portal-contacts'
import type { CustomerPortalContact } from '@/app/lib/types'
import { PhoneInput } from '@/app/components/ui/PhoneInput'
import {
  BookUser,
  Pencil,
  Plus,
  Trash2,
  X,
  Loader2,
} from 'lucide-react'

type ContactFormState = {
  name: string
  phone: string
  role_or_title: string
}

const emptyForm = (): ContactFormState => ({
  name: '',
  phone: '',
  role_or_title: '',
})

export default function CustomerContactsPage() {
  const { user, loading: authLoading } = useAuth()
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [membershipRole, setMembershipRole] = useState<PortalCustomerUserRole | null>(null)
  const [contacts, setContacts] = useState<CustomerPortalContact[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ContactFormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [completionTarget, setCompletionTarget] = useState<CustomerPortalContact | null>(null)

  const canEdit = canEditPortalContacts(membershipRole)

  const loadContacts = useCallback(async (cid: string) => {
    const rows = await listCustomerPortalContacts(cid)
    setContacts(rows)
  }, [])

  useEffect(() => {
    if (authLoading || !user) return

    const load = async () => {
      const info = await getCustomerForUser(user.id)
      if (!info) {
        setLoading(false)
        return
      }

      // Role for THIS customer_id — same scope as portal_user_may_edit_customer.
      const role = await getPortalMembershipRole(user.id, info.customerId)
      setCustomerId(info.customerId)
      setCompanyId(info.companyId)
      setMembershipRole(role)

      await loadContacts(info.customerId)
      setLoading(false)
    }

    load()
  }, [user, authLoading, loadContacts])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm())
    setError('')
    setCompletionTarget(null)
    setShowForm(true)
  }

  const openEdit = (contact: CustomerPortalContact) => {
    setEditingId(contact.id)
    setForm({
      name: contact.name,
      phone: contact.phone ?? '',
      role_or_title: contact.role_or_title ?? '',
    })
    setError('')
    setCompletionTarget(null)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setCompletionTarget(null)
    setError('')
    setForm(emptyForm())
  }

  const persistCreate = async () => {
    if (!companyId || !customerId || !user) return
    const result = await createCustomerPortalContact(companyId, customerId, user.id, {
      name: form.name,
      phone: form.phone,
      role_or_title: form.role_or_title || null,
    })
    if (result.status === 'completion_available') {
      setCompletionTarget(result.contact)
      return
    }
    await loadContacts(customerId)
    closeForm()
  }

  const handleSubmit = async () => {
    if (!canEdit || !companyId || !customerId || !user) return
    if (!form.name.trim()) {
      setError('שם איש קשר הוא שדה חובה')
      return
    }

    setSaving(true)
    setError('')
    try {
      if (editingId) {
        await updateCustomerPortalContact(companyId, customerId, editingId, {
          name: form.name,
          phone: form.phone,
          role_or_title: form.role_or_title || null,
        })
        await loadContacts(customerId)
        closeForm()
      } else {
        await persistCreate()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת איש הקשר')
    } finally {
      setSaving(false)
    }
  }

  const confirmCompletion = async () => {
    if (!canEdit || !companyId || !customerId || !completionTarget) return
    setSaving(true)
    setError('')
    try {
      await completeCustomerPortalContactPhone(
        companyId,
        customerId,
        completionTarget.id,
        form.phone,
        form.role_or_title || null
      )
      await loadContacts(customerId)
      closeForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בעדכון איש הקשר')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (contactId: string) => {
    if (!canEdit || !companyId || !customerId) return
    try {
      await deleteCustomerPortalContact(companyId, customerId, contactId)
      setDeleteConfirmId(null)
      await loadContacts(customerId)
    } catch (err) {
      console.error('Error deleting portal contact:', err)
      setError(err instanceof Error ? err.message : 'שגיאה במחיקת איש הקשר')
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
        <h1 className="text-xl font-bold text-gray-900">אנשי קשר</h1>
        <p className="text-sm text-gray-500 mt-1">
          רשימה משותפת לכל משתמשי הפורטל של הארגון
        </p>
      </div>

      <div className="flex justify-between items-center gap-3">
        <p className="text-sm text-gray-500">
          {canEdit
            ? 'ניתן להוסיף, לערוך ולמחוק אנשי קשר לשימוש מהיר בטופסי הזמנה'
            : 'צפייה ברשימה בלבד — אין הרשאת עריכה'}
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 bg-[#33d4ff] text-white px-4 py-2.5 rounded-xl hover:bg-[#21b8e6] transition-colors font-medium text-sm shrink-0"
          >
            <Plus size={18} />
            הוסף איש קשר
          </button>
        )}
      </div>

      {error && !showForm && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {contacts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <BookUser size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-1">אין אנשי קשר שמורים</p>
          <p className="text-sm text-gray-400">
            {canEdit
              ? 'הוסיפו אנשי קשר כדי למלא אותם במהירות בטופסי הזמנה'
              : 'כשיוסיפו אנשי קשר, הם יופיעו כאן'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {contacts.map((contact) => (
              <div key={contact.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-800">{contact.name}</span>
                      {contact.role_or_title && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          {contact.role_or_title}
                        </span>
                      )}
                    </div>
                    {contact.phone ? (
                      <p className="text-sm text-gray-500 mt-0.5" dir="ltr">
                        <bdi>{contact.phone}</bdi>
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 mt-0.5">ללא טלפון</p>
                    )}
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(contact)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="עריכה"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(contact.id)}
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
          <div className="bg-white w-full lg:max-w-md lg:rounded-2xl lg:mx-4 overflow-hidden rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-[#33d4ff] text-white">
              <h2 className="font-bold text-lg">
                {editingId ? 'עריכת איש קשר' : 'הוספת איש קשר'}
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

              {completionTarget && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl text-sm space-y-3">
                  <p>
                    נמצא איש קשר בשם &quot;{completionTarget.name}&quot; ללא טלפון. לעדכן אותו עם
                    המספר החדש?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCompletionTarget(null)}
                      className="flex-1 py-2 border border-amber-300 rounded-lg text-sm font-medium"
                      disabled={saving}
                    >
                      ביטול
                    </button>
                    <button
                      type="button"
                      onClick={confirmCompletion}
                      className="flex-1 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
                      disabled={saving}
                    >
                      {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'עדכן'}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-600 mb-1">שם *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  disabled={Boolean(completionTarget)}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">טלפון</label>
                <PhoneInput
                  value={form.phone}
                  onChange={(phone) => setForm({ ...form, phone })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  disabled={Boolean(completionTarget)}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">תפקיד / תואר</label>
                <input
                  type="text"
                  value={form.role_or_title}
                  onChange={(e) => setForm({ ...form, role_or_title: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#33d4ff]"
                  disabled={Boolean(completionTarget)}
                />
              </div>

              {!completionTarget && (
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
                    disabled={!form.name.trim() || saving}
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
              )}
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && canEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} className="text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">מחיקת איש קשר</h2>
              <p className="text-gray-600">האיש קשר יוסר מהרשימה המשותפת. להמשיך?</p>
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
