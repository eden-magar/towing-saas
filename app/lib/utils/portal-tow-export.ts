import type { CustomerPortalTowExportRow, CustomerTowDateField } from '@/app/lib/queries/customer-portal'
import { hebrewTowStatusLabel } from '@/app/lib/queries/tow-change-log'
import { getTowTypeLabel } from '@/app/lib/utils/tow-type-labels'
import { getFirstPickupLastDropoffAddress } from '@/app/lib/utils/portal-list-route'

const JERUSALEM = 'Asia/Jerusalem'

/** Convert a YYYY-MM-DD calendar day in Asia/Jerusalem to UTC ISO bounds. */
export function jerusalemDayBoundsIso(ymd: string): { startIso: string; endIso: string } {
  return {
    startIso: zonedLocalToUtcIso(ymd, '00:00:00.000'),
    endIso: zonedLocalToUtcIso(ymd, '23:59:59.999'),
  }
}

function zonedLocalToUtcIso(ymd: string, hms: string): string {
  const asUtc = new Date(`${ymd}T${hms}Z`)
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: JERUSALEM,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(
    dtf
      .formatToParts(asUtc)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value])
  ) as Record<string, string>
  const asLocalMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
    hms.includes('.') ? Number(hms.split('.')[1]) : 0
  )
  const offset = asLocalMs - asUtc.getTime()
  return new Date(asUtc.getTime() - offset).toISOString()
}

/** Calendar date in Asia/Jerusalem as a UTC-noon Date for Excel date cells. */
export function toJerusalemExcelDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JERUSALEM,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value
  const y = Number(get('year'))
  const m = Number(get('month'))
  const day = Number(get('day'))
  if (!y || !m || !day) return null
  return new Date(Date.UTC(y, m - 1, day, 12, 0, 0))
}

function formatVehicleLabel(
  vehicles: CustomerPortalTowExportRow['vehicles']
): string {
  const labels = vehicles
    .map((v) => {
      const makeModel = [v.manufacturer, v.model]
        .map((s) => s?.trim())
        .filter(Boolean)
        .join(' ')
      return makeModel
    })
    .filter(Boolean)
  return labels.join(', ')
}

function formatPlates(vehicles: CustomerPortalTowExportRow['vehicles']): string {
  return vehicles
    .map((v) => v.plate_number?.trim())
    .filter(Boolean)
    .join(', ')
}

function resolveExportPrice(tow: CustomerPortalTowExportRow): number | '' {
  const statusOk = tow.status === 'completed' || tow.status === 'cancelled_charged'
  if (!statusOk) return ''
  if (tow.final_price == null || Number.isNaN(Number(tow.final_price))) return ''
  return Number(tow.final_price)
}

export type BuildPortalTowWorkbookInput = {
  tows: CustomerPortalTowExportRow[]
  portalSettings: Record<string, boolean>
  dateField: CustomerTowDateField
  fromYmd: string
  toYmd: string
}

export async function downloadPortalTowsXlsx(input: BuildPortalTowWorkbookInput): Promise<void> {
  const XLSX = await import('xlsx')

  const header = [
    'מספר הזמנה',
    'מספר הזמנה שלכם',
    'תאריך',
    'סוג גרירה',
    'סטטוס',
    'לוחיות רישוי',
    'רכב',
    'כתובת מוצא',
    'כתובת יעד',
    'מחיר',
  ]

  const rows = input.tows.map((tow) => {
    const basisIso =
      input.dateField === 'scheduled_at' ? tow.scheduled_at : tow.created_at
    const { from, to } = getFirstPickupLastDropoffAddress(tow.points)
    const price = resolveExportPrice(tow)

    return [
      tow.order_number ?? '',
      tow.customer_order_number ?? '',
      toJerusalemExcelDate(basisIso) ?? '',
      getTowTypeLabel(tow.tow_type) || tow.tow_type || '',
      hebrewTowStatusLabel(tow.status) ?? tow.status,
      formatPlates(tow.vehicles),
      formatVehicleLabel(tow.vehicles),
      from ?? '',
      to ?? '',
      price,
    ]
  })

  const aoa: (string | number | Date | '')[][] = [header, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true })

  ws['!views'] = [{ rightToLeft: true }]
  ws['!cols'] = [
    { wch: 14 },
    { wch: 16 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 22 },
    { wch: 28 },
    { wch: 28 },
    { wch: 10 },
  ]

  const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    const cell = ws[addr]
    if (!cell) continue
    cell.s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '2563EB' } },
      alignment: { horizontal: 'center' },
    }
  }

  // Date column C — Excel date format
  for (let r = 1; r <= headerRange.e.r; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: 2 })
    const cell = ws[addr]
    if (cell && cell.t === 'd') {
      cell.z = 'dd/mm/yyyy'
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'גרירות')
  const filename = `girrut_${input.fromYmd}_${input.toYmd}.xlsx`
  XLSX.writeFile(wb, filename, { cellDates: true })
}

export function portalExportPresetRange(
  preset: 'this_month' | 'last_month' | 'last_3_months' | 'this_year'
): { fromYmd: string; toYmd: string } {
  const now = new Date()
  const jerusalemNow = new Intl.DateTimeFormat('en-CA', {
    timeZone: JERUSALEM,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const [yStr, mStr, dStr] = jerusalemNow.split('-')
  const y = Number(yStr)
  const m = Number(mStr)
  const d = Number(dStr)

  const pad = (n: number) => String(n).padStart(2, '0')
  const ymd = (yy: number, mm: number, dd: number) => `${yy}-${pad(mm)}-${pad(dd)}`

  if (preset === 'this_month') {
    return { fromYmd: ymd(y, m, 1), toYmd: ymd(y, m, d) }
  }
  if (preset === 'last_month') {
    const lm = m === 1 ? 12 : m - 1
    const ly = m === 1 ? y - 1 : y
    const lastDay = new Date(Date.UTC(ly, lm, 0)).getUTCDate()
    return { fromYmd: ymd(ly, lm, 1), toYmd: ymd(ly, lm, lastDay) }
  }
  if (preset === 'last_3_months') {
    const start = new Date(Date.UTC(y, m - 1, d))
    start.setUTCMonth(start.getUTCMonth() - 3)
    return {
      fromYmd: ymd(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate()),
      toYmd: ymd(y, m, d),
    }
  }
  // this_year
  return { fromYmd: ymd(y, 1, 1), toYmd: ymd(y, m, d) }
}
