'use client'

import { useEffect, useMemo, useState } from 'react'
import { RotateCcw, Trash2, X } from 'lucide-react'
import {
  isCustomerServiceSurchargeOverridden,
  resetCustomerServiceSurchargeToStandard,
  type CustomerServiceSurchargeRow,
} from '../../../lib/utils/customer-service-surcharges'

type Props = {
  open: boolean
  customerName: string
  initialRows: CustomerServiceSurchargeRow[]
  onClose: () => void
  /** Persist full catalog (matched + edits + orphans). Parent runs existing save path. */
  onSave: (rows: CustomerServiceSurchargeRow[]) => void | Promise<void>
}

function CompactServiceRow({
  row,
  onChange,
  onRemove,
  orphan,
}: {
  row: CustomerServiceSurchargeRow
  onChange: (next: CustomerServiceSurchargeRow) => void
  /** Orphan rows only — omit for company-catalog overrides. */
  onRemove?: () => void
  orphan: boolean
}) {
  const overridden = isCustomerServiceSurchargeOverridden(row)

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
        orphan
          ? 'border-gray-200 bg-white'
          : overridden
            ? 'border-amber-200 bg-amber-50/50'
            : 'border-gray-100 bg-white'
      }`}
      dir="rtl"
    >
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800" title={row.label}>
        {row.label}
      </span>

      {orphan ? (
        <span className="shrink-0 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
          ייחודי ללקוח
        </span>
      ) : overridden ? (
        <span className="shrink-0 rounded-md border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
          מותאם
        </span>
      ) : null}

      <select
        value={row.price_type}
        onChange={(e) =>
          onChange({
            ...row,
            price_type: e.target.value as CustomerServiceSurchargeRow['price_type'],
          })
        }
        className="shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30"
      >
        <option value="fixed">קבוע</option>
        <option value="per_unit">ליחידה</option>
        <option value="manual">ידני</option>
      </select>

      <label
        className="flex shrink-0 items-center gap-1 text-[10px] text-gray-500"
        title="לא נכלל במע״מ ולא בהנחת לקוח"
      >
        <input
          type="checkbox"
          checked={row.is_vat_exempt === true}
          onChange={(e) => onChange({ ...row, is_vat_exempt: e.target.checked })}
          className="rounded accent-[#33d4ff]"
        />
        פטור
      </label>

      <div className="relative w-[5.5rem] shrink-0">
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">₪</span>
        <input
          type="number"
          value={row.price}
          onChange={(e) => onChange({ ...row, price: Number(e.target.value) })}
          className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-2 pr-6 text-sm focus:outline-none focus:ring-2 focus:ring-[#33d4ff]/30"
        />
      </div>

      {!orphan && overridden && row.companyStandard && (
        <>
          <span className="shrink-0 text-[11px] text-amber-800/80 whitespace-nowrap">
            רגיל: ₪{row.companyStandard.price}
          </span>
          <button
            type="button"
            title="חזרה למחיר רגיל"
            onClick={() => onChange(resetCustomerServiceSurchargeToStandard(row))}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-lg px-1.5 py-1 text-[10px] font-medium text-amber-800 hover:bg-amber-100"
          >
            <RotateCcw size={12} />
            איפוס
          </button>
        </>
      )}

      {orphan && onRemove && (
        <button
          type="button"
          title="מחק תוספת"
          aria-label={`מחק את התוספת ${row.label}`}
          onClick={onRemove}
          className="p-1 text-gray-400 hover:text-red-500 shrink-0"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}

export function CustomerServiceSurchargesModal({
  open,
  customerName,
  initialRows,
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<CustomerServiceSurchargeRow[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDraft(initialRows.map((r) => ({ ...r, companyStandard: r.companyStandard })))
  }, [open, initialRows])

  const { companyRows, orphanRows } = useMemo(() => {
    const company: CustomerServiceSurchargeRow[] = []
    const orphans: CustomerServiceSurchargeRow[] = []
    for (const row of draft) {
      if (row.isOrphan || !row.companyStandard) orphans.push(row)
      else company.push(row)
    }
    return { companyRows: company, orphanRows: orphans }
  }, [draft])

  const updateRow = (id: string, next: CustomerServiceSurchargeRow) => {
    setDraft((prev) => prev.map((r) => (r.id === id ? next : r)))
  }

  /** Local draft only — persists when the user presses שמור. */
  const removeOrphanRow = (row: CustomerServiceSurchargeRow) => {
    const label = row.label.trim() || 'תוספת זו'
    const priceLabel = Number.isFinite(Number(row.price)) ? `₪${row.price}` : ''
    const ok = window.confirm(
      priceLabel
        ? `למחוק את התוספת «${label}» (${priceLabel})?\nהשינוי יישמר רק לאחר לחיצה על שמור.`
        : `למחוק את התוספת «${label}»?\nהשינוי יישמר רק לאחר לחיצה על שמור.`,
    )
    if (!ok) return
    setDraft((prev) => prev.filter((r) => r.id !== row.id))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(draft)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4" dir="rtl">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 bg-[#33d4ff] px-5 py-4 text-white">
          <div>
            <h2 className="font-bold">תוספות שירות</h2>
            <p className="text-sm text-white/80">{customerName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-white/20"
            aria-label="סגור"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <section>
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-gray-800">מחירון החברה</h3>
              <p className="text-xs text-gray-400">
                מחיר שונה מסומן כ״מותאם״. שירות חדש בחברה יופיע כאן אחרי פתיחה ושמירה מחדש.
              </p>
            </div>
            {companyRows.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-3 py-4 text-center text-xs text-gray-400">
                אין תוספות שירות פעילות במחירון החברה
              </p>
            ) : (
              <div className="space-y-1.5">
                {companyRows.map((row) => (
                  <CompactServiceRow
                    key={row.id}
                    row={row}
                    orphan={false}
                    onChange={(next) => updateRow(row.id, next)}
                  />
                ))}
              </div>
            )}
          </section>

          {orphanRows.length > 0 && (
            <section>
              <div className="mb-2">
                <h3 className="text-sm font-semibold text-gray-800">תוספות ייחודיות ללקוח</h3>
                <p className="text-xs text-gray-400">
                  שירותים שנשמרו ללקוח זה בלבד (לא מופיעים במחירון החברה הפעיל). ניתן להשאיר, לערוך או למחוק.
                </p>
              </div>
              <div className="space-y-1.5">
                {orphanRows.map((row) => (
                  <CompactServiceRow
                    key={row.id}
                    row={row}
                    orphan
                    onChange={(next) => updateRow(row.id, next)}
                    onRemove={() => removeOrphanRow(row)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="flex gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex-1 rounded-xl bg-[#33d4ff] py-2.5 font-medium text-white hover:bg-[#21b8e6] disabled:opacity-50"
          >
            {saving ? 'שומר...' : 'שמור'}
          </button>
        </div>
      </div>
    </div>
  )
}
