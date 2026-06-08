import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/app/lib/auth'

const OCR_MODEL = 'gpt-4o-mini' as const

type PlateOcrRequestBody = {
  imageDataUrl?: unknown
}

type OpenAiMessageContentPart = {
  type: string
  text?: string
}

type OpenAiChatCompletionChoice = {
  index: number
  message: {
    role: string
    content: string | OpenAiMessageContentPart[] | null
    refusal?: string | null
  }
  finish_reason: string | null
}

type OpenAiChatCompletionResponse = {
  id: string
  object: string
  created: number
  model: string
  choices: OpenAiChatCompletionChoice[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  system_fingerprint?: string
}

type PlateOcrSuccessResponse = {
  plateNumber: string
  rawResponse: OpenAiChatCompletionResponse
  model: typeof OCR_MODEL
}

const PLATE_OCR_INSTRUCTION =
  'Read the Israeli vehicle license plate number from this image. Respond with ONLY the digits of the plate number — no spaces, no dashes, no letters, no explanation, no other text.'

function extractMessageText(content: OpenAiChatCompletionChoice['message']['content']): string {
  if (typeof content === 'string') {
    return content.trim()
  }
  if (Array.isArray(content)) {
    const textPart = content.find((part) => part.type === 'text' && part.text)
    return (textPart?.text ?? '').trim()
  }
  return ''
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthUser(request)
    if (!currentUser) {
      return unauthorizedResponse()
    }

    let body: PlateOcrRequestBody
    try {
      body = (await request.json()) as PlateOcrRequestBody
    } catch {
      return NextResponse.json({ error: 'imageDataUrl required' }, { status: 400 })
    }

    const imageDataUrl = typeof body.imageDataUrl === 'string' ? body.imageDataUrl.trim() : ''
    if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: 'imageDataUrl required' }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('[plate-ocr] OPENAI_API_KEY not configured')
      return NextResponse.json({ error: 'OCR service unavailable' }, { status: 503 })
    }

    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OCR_MODEL,
        max_tokens: 20,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PLATE_OCR_INSTRUCTION },
              { type: 'image_url', image_url: { url: imageDataUrl, detail: 'low' } },
            ],
          },
        ],
      }),
    })

    if (!openAiResponse.ok) {
      console.error('[plate-ocr] OpenAI request failed', openAiResponse.status)
      return NextResponse.json({ error: 'Plate recognition failed' }, { status: 502 })
    }

    let rawResponse: OpenAiChatCompletionResponse
    try {
      rawResponse = (await openAiResponse.json()) as OpenAiChatCompletionResponse
    } catch {
      return NextResponse.json({ error: 'Invalid OCR response' }, { status: 502 })
    }

    const plateNumber = extractMessageText(rawResponse.choices[0]?.message?.content ?? null)

    const successBody: PlateOcrSuccessResponse = {
      plateNumber,
      rawResponse,
      model: OCR_MODEL,
    }

    return NextResponse.json(successBody)
  } catch (err) {
    console.error('[plate-ocr] internal error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
