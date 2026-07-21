/**
 * Seed / merge company service surcharges into a customer's edit list.
 * Calc still uses resolveSurchargeCatalog (full customer catalog replace when non-empty).
 *
 * Match key: LABEL only (case-insensitive). Company and customer rows live in the same
 * `service_surcharges` table but are separate rows — customer saves go through
 * `replace_customer_surcharges`, which DELETE+INSERTs and assigns new UUIDs. There is no
 * `company_service_id` (or other FK) linking a customer row to a company row, so id-matching
 * across catalogs is impossible. Risk: renaming a company label orphans the customer's
 * override (kept as isOrphan); two company rows with the same label are matched in order
 * (first unused customer row with that label).
 *
 * TODO(company-service-sync): If the company later adds a new service surcharge, existing
 * customer catalogs stay frozen until the customer modal is re-opened (re-merge) and re-saved.
 * No auto-sync on company save.
 */

export type ServiceSurchargeSeed = {
  id: string
  label: string
  price: number
  price_type: 'fixed' | 'per_unit' | 'manual'
  unit_label?: string
  is_active: boolean
  is_vat_exempt?: boolean
}

export type CustomerServiceSurchargeRow = ServiceSurchargeSeed & {
  /** Snapshot of the matching active company service; null when the row is an orphan. */
  companyStandard: {
    price: number
    price_type: 'fixed' | 'per_unit' | 'manual'
    unit_label: string
    is_active: boolean
    is_vat_exempt: boolean
  } | null
  /**
   * Saved customer line whose label no longer matches any *active* company service
   * (renamed, deleted, or deactivated). Kept so overrides are not silently dropped.
   */
  isOrphan?: boolean
}

function labelKey(label: string): string {
  return label.trim().toLowerCase()
}

export function isCustomerServiceSurchargeOverridden(
  row: CustomerServiceSurchargeRow
): boolean {
  if (row.isOrphan || !row.companyStandard) return true
  return (
    Number(row.price) !== Number(row.companyStandard.price) ||
    row.price_type !== row.companyStandard.price_type ||
    (row.unit_label || '') !== row.companyStandard.unit_label ||
    row.is_active !== row.companyStandard.is_active ||
    (row.is_vat_exempt === true) !== row.companyStandard.is_vat_exempt
  )
}

function takeMatchingSaved(
  remaining: ServiceSurchargeSeed[],
  companyLabel: string
): ServiceSurchargeSeed | null {
  const key = labelKey(companyLabel)
  const idx = remaining.findIndex((s) => labelKey(s.label) === key)
  if (idx < 0) return null
  const [saved] = remaining.splice(idx, 1)
  return saved ?? null
}

/**
 * One row per *active* company service (inactive company rows are not seeded).
 * Customer-saved rows matched by label (consumed in order for duplicate labels).
 * Unmatched customer-saved rows are appended as orphans so overrides are not lost.
 */
export function mergeCompanyServiceSurchargesForCustomer(
  companyServices: ServiceSurchargeSeed[],
  customerSaved: ServiceSurchargeSeed[]
): CustomerServiceSurchargeRow[] {
  const remaining = customerSaved.filter((s) => s.label?.trim())
  const activeCompany = companyServices.filter((s) => s.is_active)

  const rows: CustomerServiceSurchargeRow[] = activeCompany.map((company) => {
    const companyStandard = {
      price: company.price,
      price_type: company.price_type,
      unit_label: company.unit_label || '',
      is_active: company.is_active,
      is_vat_exempt: company.is_vat_exempt === true,
    }
    const saved = takeMatchingSaved(remaining, company.label)
    if (!saved) {
      return {
        id: `seed_${company.id}`,
        label: company.label,
        price: company.price,
        price_type: company.price_type,
        unit_label: company.unit_label || '',
        is_active: company.is_active,
        is_vat_exempt: company.is_vat_exempt === true,
        companyStandard,
      }
    }
    return {
      id: saved.id,
      label: company.label,
      price: saved.price,
      price_type: saved.price_type,
      unit_label: saved.unit_label || '',
      is_active: saved.is_active,
      is_vat_exempt: saved.is_vat_exempt === true,
      companyStandard,
    }
  })

  for (const orphan of remaining) {
    rows.push({
      id: orphan.id,
      label: orphan.label,
      price: orphan.price,
      price_type: orphan.price_type,
      unit_label: orphan.unit_label || '',
      is_active: orphan.is_active,
      is_vat_exempt: orphan.is_vat_exempt === true,
      companyStandard: null,
      isOrphan: true,
    })
  }

  return rows
}

export function resetCustomerServiceSurchargeToStandard(
  row: CustomerServiceSurchargeRow
): CustomerServiceSurchargeRow {
  if (!row.companyStandard) return row
  return {
    ...row,
    price: row.companyStandard.price,
    price_type: row.companyStandard.price_type,
    unit_label: row.companyStandard.unit_label,
    is_active: row.companyStandard.is_active,
    is_vat_exempt: row.companyStandard.is_vat_exempt,
    isOrphan: false,
  }
}
