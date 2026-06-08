import { supabase } from '../supabase'

const EVENT_PLATES_BUCKET = 'event-plates'

export async function uploadPlateImage(eventId: string, file: File): Promise<string> {
  const path = `${eventId}/${Date.now()}.jpg`

  const { error } = await supabase.storage.from(EVENT_PLATES_BUCKET).upload(path, file)

  if (error) {
    console.error('Error uploading plate image:', error)
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

export interface SavePlateRecognitionInput {
  companyId: string
  eventId: string
  driverId: string | null
  imagePath: string
  gptRawResponse: unknown
  gptPlateNumber: string | null
  gptModel: string | null
  confirmedPlateNumber: string
  wasCorrected: boolean
  captureLat: number | null
  captureLng: number | null
}

export async function savePlateRecognition(input: SavePlateRecognitionInput): Promise<void> {
  const { error } = await supabase.from('event_plate_recognitions').insert({
    company_id: input.companyId,
    event_id: input.eventId,
    driver_id: input.driverId,
    image_path: input.imagePath,
    gpt_raw_response: input.gptRawResponse,
    gpt_plate_number: input.gptPlateNumber,
    gpt_model: input.gptModel,
    confirmed_plate_number: input.confirmedPlateNumber,
    was_corrected: input.wasCorrected,
    capture_lat: input.captureLat,
    capture_lng: input.captureLng,
  })

  if (error) {
    console.error('Error saving plate recognition:', JSON.stringify(error, null, 2))
    throw error
  }
}
