import { supabase } from '../supabase'

const EVENT_IMAGES_BUCKET = 'event-images'

export async function uploadEventImage(eventId: string, file: File): Promise<string> {
  const path = `${eventId}/${Date.now()}.jpg`

  const { error } = await supabase.storage.from(EVENT_IMAGES_BUCKET).upload(path, file)

  if (error) {
    console.error('Error uploading event image:', error)
    throw error
  }

  return path
}

export interface PlateRecognitionResult {
  plateNumber: string
  rawResponse: unknown
  model: string
}

type PlateOcrApiSuccessBody = {
  plateNumber: string
  rawResponse: unknown
  model: string
}

type PlateOcrApiErrorBody = {
  error?: string
}

export async function recognizePlate(imagePath: string): Promise<PlateRecognitionResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) {
    throw new Error('לא מחובר')
  }

  const res = await fetch('/api/events/plate-ocr', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ imagePath }),
  })

  if (!res.ok) {
    let message = 'שגיאה בזיהוי מספר רישוי'
    try {
      const errBody = (await res.json()) as PlateOcrApiErrorBody
      if (errBody.error) {
        message = errBody.error
      }
    } catch {
      // keep default message
    }
    throw new Error(message)
  }

  const body = (await res.json()) as PlateOcrApiSuccessBody
  return {
    plateNumber: body.plateNumber,
    rawResponse: body.rawResponse,
    model: body.model,
  }
}
