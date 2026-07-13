'use client'

import { MapPin } from 'lucide-react'
import { useTowForm } from '../../../hooks/useTowForm'
import type { ContactsSave } from '../../../hooks/useContactsSave'
import { FormCard } from '../../ui'
import { PhoneInput } from '../../ui/PhoneInput'
import { ContactNameAutocomplete } from '../../customer-contacts/ContactNameAutocomplete'
import { SaveCustomerContactPill } from '../../customer-contacts/SaveCustomerContactPill'
import { phoneFromSelectedContact } from '../../../lib/utils/customer-contact-save-ui'

type Form = ReturnType<typeof useTowForm>

const inputClass =
  'w-full px-3 h-12 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] bg-white'

/**
 * Pickup + dropoff contacts and notes for single tows on the mobile scroll page.
 * Mirrors create/page.tsx Section 8 (אנשי קשר) — gated by quoteApproved in parent.
 * Visual pattern matches SingleRoute address blocks (bordered white blocks,
 * color-coded origin/destination MapPin icons).
 */
export function SectionContacts({
  form,
  contactsSave,
}: {
  form: Form
  contactsSave: ContactsSave
}) {
  return (
    <FormCard icon={MapPin} title="אנשי קשר">
      <div className="space-y-2">
        {/* מוצא — בלוק מקובץ */}
        <div className="bg-white border border-gray-200 rounded-xl p-2.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <MapPin size={16} className="text-emerald-500 shrink-0" />
              איש קשר במוצא
            </span>
            {!form.selectedCustomerId && (
              <button
                type="button"
                onClick={() => form.copyFromCustomer('pickup')}
                className="shrink-0 min-h-[36px] px-2.5 text-xs font-medium rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
              >
                כמו לקוח 👤
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <div className="flex-[2] min-w-0">
              <label className="block text-xs text-gray-500 mb-1">שם</label>
              <ContactNameAutocomplete
                value={form.pickupContactName}
                onChange={form.setPickupContactName}
                onSelectContact={(contact) => {
                  form.setPickupContactName(contact.name)
                  form.setPickupContactPhone(
                    phoneFromSelectedContact(contact.phone, form.pickupContactPhone)
                  )
                  contactsSave.setSavePickupContactToCustomer(false)
                }}
                contacts={contactsSave.savedContacts}
                loading={contactsSave.contactsLoading}
                disabled={form.saving}
                placeholder="שם איש קשר"
                className={inputClass}
              />
            </div>
            <div className="flex-[3] min-w-0">
              <label className="block text-xs text-gray-500 mb-1">טלפון</label>
              <PhoneInput
                value={form.pickupContactPhone}
                onChange={form.setPickupContactPhone}
                placeholder="טלפון"
                className={inputClass}
              />
            </div>
          </div>
          <SaveCustomerContactPill
            className="min-h-[36px] px-2.5"
            visible={contactsSave.showSavePickupContactOption}
            active={contactsSave.savePickupContactToCustomer}
            onToggle={() =>
              contactsSave.setSavePickupContactToCustomer((prev) => !prev)
            }
            disabled={form.saving}
          />
        </div>

        {/* יעד — בלוק מקובץ */}
        <div className="bg-white border border-gray-200 rounded-xl p-2.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <MapPin size={16} className="text-red-500 shrink-0" />
              איש קשר ביעד
            </span>
            {!form.selectedCustomerId && (
              <button
                type="button"
                onClick={() => form.copyFromCustomer('dropoff')}
                className="shrink-0 min-h-[36px] px-2.5 text-xs font-medium rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
              >
                כמו לקוח 👤
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <div className="flex-[2] min-w-0">
              <label className="block text-xs text-gray-500 mb-1">שם</label>
              <ContactNameAutocomplete
                value={form.dropoffContactName}
                onChange={form.setDropoffContactName}
                onSelectContact={(contact) => {
                  form.setDropoffContactName(contact.name)
                  form.setDropoffContactPhone(
                    phoneFromSelectedContact(contact.phone, form.dropoffContactPhone)
                  )
                  contactsSave.setSaveDropoffContactToCustomer(false)
                }}
                contacts={contactsSave.savedContacts}
                loading={contactsSave.contactsLoading}
                disabled={form.saving}
                placeholder="שם איש קשר"
                className={inputClass}
              />
            </div>
            <div className="flex-[3] min-w-0">
              <label className="block text-xs text-gray-500 mb-1">טלפון</label>
              <PhoneInput
                value={form.dropoffContactPhone}
                onChange={form.setDropoffContactPhone}
                placeholder="טלפון"
                className={inputClass}
              />
            </div>
          </div>
          <SaveCustomerContactPill
            className="min-h-[36px] px-2.5"
            visible={contactsSave.showSaveDropoffContactOption}
            active={contactsSave.saveDropoffContactToCustomer}
            onToggle={() =>
              contactsSave.setSaveDropoffContactToCustomer((prev) => !prev)
            }
            disabled={form.saving}
          />
        </div>

        {/* הערות — מופרד מקבוצת אנשי הקשר */}
        <div className="border-t border-gray-100 pt-3 mt-1">
          <label className="block text-sm font-semibold text-gray-700 mb-2">הערות</label>
          <textarea
            value={form.notes}
            onChange={(e) => form.setNotes(e.target.value)}
            rows={2}
            placeholder="הערות"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff] resize-none"
          />
        </div>
      </div>
    </FormCard>
  )
}
