import { logTowAction, type TowChangeEntry } from '../queries/tow-change-log'

export type StorageYardConfirmOutcome = 'yes' | 'no' | 'dismissed'

export type StorageYardConfirmAnswer = {
  fieldKey: string
  role: 'pickup' | 'dropoff'
  outcome: StorageYardConfirmOutcome
  address: string
}

const FIELD_LABELS: Record<string, string> = {
  'exchange-working-origin': 'מוצא רכב תקין',
  'exchange-defective-dest': 'יעד רכב תקול',
  'create-working-origin': 'מוצא רכב תקין',
  'create-working-dest': 'יעד רכב תקין',
  'create-defective-dest': 'יעד רכב תקול',
  'create-pickup': 'מוצא גרירה',
  'create-dropoff': 'יעד גרירה',
  'create-single-dropoff': 'יעד גרירה',
  'create-single-pickup': 'מוצא גרירה',
}

const OUTCOME_HEBREW: Record<StorageYardConfirmOutcome, string> = {
  yes: 'כן',
  no: 'לא',
  dismissed: 'נסגר',
}

function fieldLabel(fieldKey: string, role: 'pickup' | 'dropoff'): string {
  if (FIELD_LABELS[fieldKey]) return FIELD_LABELS[fieldKey]
  return role === 'pickup' ? 'מוצא' : 'יעד'
}

/** Build a tow_change_log entry for a yard-confirm answer (does not write). */
export function storageYardConfirmLogEntry(
  answer: StorageYardConfirmAnswer,
): TowChangeEntry {
  const addr = answer.address.trim() || '—'
  const where = fieldLabel(answer.fieldKey, answer.role)
  return {
    field_name: 'אישור אחסנה',
    old_value: null,
    new_value: `${OUTCOME_HEBREW[answer.outcome]} — ${where} — ${addr}`,
  }
}

/**
 * Persist a yard-confirm answer to tow history. Never throws.
 * Prefer buffering on create and calling this after the tow exists.
 */
export async function logStorageYardConfirmAnswer(
  towId: string,
  answer: StorageYardConfirmAnswer,
  actingUserId?: string | null,
): Promise<void> {
  await logTowAction(towId, [storageYardConfirmLogEntry(answer)], actingUserId)
}
