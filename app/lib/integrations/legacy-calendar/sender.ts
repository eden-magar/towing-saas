import type { LegacySpecialEventPayload } from './event-mapper'
import type { LegacyPayload } from './types'

export type LegacyCalendarPayload = LegacyPayload | LegacySpecialEventPayload

export type LegacyCalendarSendResult = {
  ok: boolean
  status: number
  error?: string
}

/**
 * POST payload to a Google Apps Script web app exactly as the legacy Express
 * handler does (server.js ~379–386): urlencoded body with a single `data` field.
 */
export async function sendToLegacyCalendar(
  url: string,
  payload: LegacyCalendarPayload
): Promise<LegacyCalendarSendResult> {
  try {
    const encodedBody = 'data=' + encodeURIComponent(JSON.stringify(payload))

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: encodedBody,
      redirect: 'follow',
    })

    return { ok: true, status: response.status }
  } catch (err) {
    return { ok: false, status: 0, error: String(err) }
  }
}
