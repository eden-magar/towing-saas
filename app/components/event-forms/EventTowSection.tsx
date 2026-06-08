'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Check, Loader2 } from 'lucide-react'
import { FormCard, FormSubcard, Input, Button } from '../ui'
import { DriverCalendarPicker } from '../DriverCalendarPicker'
import { AddressInput, type AddressData } from '../tow-forms/routes/AddressInput'
import { PinDropModal } from '../tow-forms/shared/PinDropModal'
import { useAuth } from '../../lib/AuthContext'
import { getDrivers } from '../../lib/queries/drivers'
import { createEvent } from '../../lib/queries/events'
import { supabase } from '../../lib/supabase'
import { getCompanySettings } from '../../lib/queries/settings'
import { calculateEventPrice } from '../../lib/utils/event-pricing'
import type { DriverWithDetails } from '../../lib/types'

function formatMoney(value: number): string {
  return `₪${value.toFixed(2)}`
}

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
  const [driverPickerOpen, setDriverPickerOpen] = useState(false)
  const [drivers, setDrivers] = useState<DriverWithDetails[]>([])
  const [driversLoading, setDriversLoading] = useState(false)
  const [priceMode, setPriceMode] = useState<'manual' | 'pricelist'>('manual')
  const [manualPrice, setManualPrice] = useState('')
  const [includesVat, setIncludesVat] = useState(true)
  const [adjustmentType, setAdjustmentType] = useState<'discount' | 'surcharge'>('discount')
  const [adjustmentPercent, setAdjustmentPercent] = useState('')
  const [vatRate, setVatRate] = useState(0.18)
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

  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    getCompanySettings(companyId)
      .then((settings) => {
        if (cancelled) return
        const pct = settings?.default_vat_percent ?? 18
        setVatRate(pct / 100)
      })
      .catch((err) => {
        console.error('Error loading company VAT for event:', err)
      })
    return () => {
      cancelled = true
    }
  }, [companyId])

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId) ?? null

  const enteredPrice = useMemo(() => {
    const trimmed = manualPrice.trim()
    if (!trimmed) return null
    const parsed = parseFloat(trimmed)
    return Number.isNaN(parsed) ? null : parsed
  }, [manualPrice])

  const parsedAdjustment = useMemo(() => {
    const trimmed = adjustmentPercent.trim()
    if (!trimmed) return 0
    const parsed = parseFloat(trimmed)
    return Number.isNaN(parsed) ? 0 : Math.max(0, parsed)
  }, [adjustmentPercent])

  const priceResult = useMemo(() => {
    if (enteredPrice == null) return null
    return calculateEventPrice({
      enteredPrice,
      includesVat,
      discountPercent: adjustmentType === 'discount' ? parsedAdjustment : 0,
      surchargePercent: adjustmentType === 'surcharge' ? parsedAdjustment : 0,
      vatRate,
    })
  }, [enteredPrice, includesVat, adjustmentType, parsedAdjustment, vatRate])

  const vatPercentLabel = Math.round(vatRate * 100)
  const displayTotal = priceResult?.total ?? 0

  const eventSummaryLine = useMemo(() => {
    const parts: string[] = []
    if (towDate) {
      parts.push(
        new Date(`${towDate}T12:00:00`).toLocaleDateString('he-IL', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      )
    }
    if (towTime && towEndTime) {
      parts.push(`${towTime}–${towEndTime}`)
    }
    const loc = location.address.trim()
    if (loc) {
      parts.push(loc.length > 40 ? `${loc.slice(0, 40)}…` : loc)
    }
    return parts.join(' • ')
  }, [towDate, towTime, towEndTime, location.address])

  const handleSave = async (status: 'approved' | 'quote') => {
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
        manualPrice: enteredPrice,
        finalPrice: priceResult?.total ?? null,
        priceBreakdown: priceResult,
        status,
      })

      if (status === 'approved') {
        void (async () => {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession()
            const token = session?.access_token
            if (!token) return
            const res = await fetch('/api/integrations/legacy-calendar/sync-event', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ event_id: result.id }),
            })
            if (!res.ok) {
              console.warn('[legacy-calendar-sync-event] sync request failed', res.status)
            }
          } catch (err) {
            console.warn('[legacy-calendar-sync-event] sync request failed', err)
          }
        })()
      }

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
          {selectedDriver ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
              <span className="text-sm font-medium text-gray-800">
                {selectedDriver.user?.full_name || 'נהג ללא שם'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDriverPickerOpen(true)}
                  disabled={driversLoading || saving}
                  className="text-sm font-medium text-[#21b8e6] hover:text-[#1a9bc7] disabled:opacity-50"
                >
                  שנה
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDriverId('')}
                  disabled={saving}
                  className="text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
                >
                  הסר נהג
                </button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDriverPickerOpen(true)}
              disabled={driversLoading || saving}
              className="w-full"
            >
              שבץ נהג
            </Button>
          )}
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

        {/* מחיר — styled like tow pricing block */}
        <section className="bg-white rounded-2xl border border-gray-300 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-300">
            <h2 className="font-bold text-gray-800 text-sm">מחיר</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPriceMode('manual')}
                className={`px-4 py-2 rounded-xl text-sm ${
                  priceMode === 'manual' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                ידני
              </button>
              <button
                type="button"
                disabled
                title="יחובר בהמשך"
                className="px-4 py-2 rounded-xl text-sm bg-gray-100 text-gray-400 cursor-not-allowed"
              >
                מחירון
                <span className="mr-1 text-xs opacity-75">(יחובר בהמשך)</span>
              </button>
            </div>

            {priceMode === 'manual' && (
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  placeholder="מחיר"
                  disabled={saving}
                  className="px-4 py-2.5 border border-gray-300 rounded-xl w-32 text-sm dir-ltr text-right"
                />
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includesVat}
                    onChange={(e) => setIncludesVat(e.target.checked)}
                    disabled={saving}
                    className="rounded border-gray-300"
                  />
                  המחיר כולל מע״מ
                </label>
              </div>
            )}

            <div className="text-sm space-y-1">
              {priceResult ? (
                <>
                  <p className="text-gray-500">
                    לפני מע״מ: {formatMoney(priceResult.beforeVat)}
                  </p>
                  {priceResult.discountAmount > 0 && (
                    <p className="text-gray-500">
                      הנחה ({priceResult.discountPercent}%): -{formatMoney(priceResult.discountAmount)}
                    </p>
                  )}
                  {priceResult.surchargeAmount > 0 && (
                    <p className="text-gray-500">
                      תוספת ({priceResult.surchargePercent}%): +{formatMoney(priceResult.surchargeAmount)}
                    </p>
                  )}
                  <p className="text-gray-500">
                    מע״מ ({vatPercentLabel}%): {formatMoney(priceResult.vatAmount)}
                  </p>
                  <p className="font-bold text-base text-gray-900">
                    סה״כ: {formatMoney(priceResult.total)}
                  </p>
                </>
              ) : (
                <p className="text-gray-400 text-sm">הזן מחיר ידני לחישוב פירוט</p>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-gray-200 mt-2">
                <button
                  type="button"
                  onClick={() => setAdjustmentType('discount')}
                  disabled={saving}
                  className={`px-2.5 py-1 rounded-lg text-xs ${
                    adjustmentType === 'discount'
                      ? 'bg-red-500 text-white'
                      : 'bg-white text-gray-700 border border-gray-300'
                  }`}
                >
                  הנחה
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType('surcharge')}
                  disabled={saving}
                  className={`px-2.5 py-1 rounded-lg text-xs ${
                    adjustmentType === 'surcharge'
                      ? 'bg-green-500 text-white'
                      : 'bg-white text-gray-700 border border-gray-300'
                  }`}
                >
                  תוספת
                </button>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={adjustmentPercent}
                  onChange={(e) => setAdjustmentPercent(e.target.value)}
                  placeholder="%"
                  disabled={saving}
                  className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-sm text-center dir-ltr"
                />
                <span className="text-xs text-gray-500">אחוז</span>
              </div>
            </div>
          </div>
        </section>

        {/* הצעת מחיר — אישור טלפוני */}
        <section className="bg-amber-50 rounded-2xl border-2 border-amber-300 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-4 sm:py-5">
            <h3 className="font-bold text-amber-900 text-lg mb-2">
              הצעת מחיר — אישור טלפוני
            </h3>
            <p className="text-3xl font-bold text-amber-900 mb-2">
              {formatMoney(displayTotal)}
            </p>
            {eventSummaryLine && (
              <p className="text-sm text-amber-800 mb-4">{eventSummaryLine}</p>
            )}
            {!eventSummaryLine && <div className="mb-4" />}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleSave('quote')}
                disabled={saving}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={20} className="animate-spin inline" />
                ) : (
                  'לא אישר — שמור כהצעה'
                )}
              </button>
              <button
                type="button"
                onClick={() => handleSave('approved')}
                disabled={saving}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <Check size={20} />
                    הלקוח אישר ✓
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
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

      {driverPickerOpen && (
        <DriverCalendarPicker
          companyId={companyId || ''}
          drivers={drivers}
          requiredTruckTypes={[]}
          initialDate={towDate}
          initialTime={towTime}
          onConfirm={(driverId) => {
            setSelectedDriverId(driverId)
            setDriverPickerOpen(false)
          }}
          onClose={() => setDriverPickerOpen(false)}
        />
      )}
    </FormCard>
  )
}
