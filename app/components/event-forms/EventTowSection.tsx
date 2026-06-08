'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Loader2 } from 'lucide-react'
import { FormCard, FormSubcard, Input, Button } from '../ui'
import { AddressInput, type AddressData } from '../tow-forms/routes/AddressInput'
import { PinDropModal } from '../tow-forms/shared/PinDropModal'
import { useAuth } from '../../lib/AuthContext'
import { getDrivers } from '../../lib/queries/drivers'
import { createEvent } from '../../lib/queries/events'
import type { DriverWithDetails } from '../../lib/types'

const selectClassName =
  'w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white disabled:opacity-60'

interface EventTowSectionProps {
  selectedCustomerId: string | null
  towDate: string
  towTime: string
  towEndTime: string
}

export function EventTowSection({
  selectedCustomerId,
  towDate,
  towTime,
  towEndTime,
}: EventTowSectionProps) {
  const router = useRouter()
  const { user, companyId } = useAuth()

  const [location, setLocation] = useState<AddressData>({ address: '' })
  const [pinOpen, setPinOpen] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [details, setDetails] = useState('')
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [drivers, setDrivers] = useState<DriverWithDetails[]>([])
  const [driversLoading, setDriversLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    setDriversLoading(true)
    getDrivers(companyId)
      .then((data) => {
        if (!cancelled) setDrivers(data)
      })
      .catch((err) => {
        console.error('Error loading drivers for event:', err)
        if (!cancelled) setError('שגיאה בטעינת רשימת הנהגים')
      })
      .finally(() => {
        if (!cancelled) setDriversLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [companyId])

  const handleSave = async () => {
    if (!companyId || !user) return

    if (!selectedCustomerId) {
      setError('יש לבחור לקוח לפני שמירת האירוע')
      return
    }

    if (!towDate || !towTime || !towEndTime) {
      setError('יש למלא תאריך, שעת התחלה ושעת סיום')
      return
    }

    if (towEndTime <= towTime) {
      setError('שעת הסיום חייבת להיות אחרי שעת ההתחלה')
      return
    }

    if (!location.address.trim()) {
      setError('יש להזין מיקום לאירוע')
      return
    }

    setSaving(true)
    setError('')

    try {
      const result = await createEvent({
        companyId,
        createdBy: user.id,
        customerId: selectedCustomerId,
        driverId: selectedDriverId || null,
        locationAddress: location.address.trim(),
        locationLat: location.lat ?? null,
        locationLng: location.lng ?? null,
        contactName: contactName.trim() || null,
        contactPhone: contactPhone.trim() || null,
        details: details.trim() || null,
        eventDate: towDate,
        startTime: towTime,
        endTime: towEndTime,
      })
      router.push(`/dashboard/events/${result.id}`)
    } catch {
      setError('שגיאה בשמירת האירוע, נסה שוב')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormCard
      icon={Calendar}
      title="פרטי אירוע"
      description="מיקום, איש קשר ופרטים נוספים"
    >
      <div className="p-3 sm:p-4 space-y-3" dir="rtl">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <FormSubcard title="מיקום">
          <AddressInput
            value={location}
            onChange={(d: AddressData) => setLocation(d)}
            hideLabel
            placeholder="הזן כתובת או הדבק קישור..."
            onPinDropClick={() => setPinOpen(true)}
            readOnly={saving}
          />
        </FormSubcard>

        <FormSubcard title="איש קשר">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="שם"
              className="w-full"
            />
            <Input
              type="text"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="טלפון"
              className="w-full dir-ltr text-right"
            />
          </div>
        </FormSubcard>

        <FormSubcard title="נהג (אופציונלי)">
          <select
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            disabled={driversLoading}
            className={selectClassName}
          >
            <option value="">ללא נהג</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.user?.full_name || 'נהג ללא שם'}
              </option>
            ))}
          </select>
        </FormSubcard>

        <FormSubcard title="פרטים">
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            placeholder="פרטים נוספים על האירוע..."
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gt-brand/30"
          />
        </FormSubcard>

        <Button
          type="button"
          variant="primary"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3"
        >
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 size={18} className="animate-spin" />
              שומר...
            </span>
          ) : (
            'שמור אירוע'
          )}
        </Button>
      </div>

      <PinDropModal
        isOpen={pinOpen}
        onClose={() => setPinOpen(false)}
        onConfirm={(d) => {
          setLocation(d)
          setPinOpen(false)
        }}
        initialAddress={location}
        title="בחר מיקום אירוע"
      />
    </FormCard>
  )
}
