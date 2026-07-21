import type { Metadata } from 'next'
import {
  getValidShareLink,
  listTowImagesForShareGallery,
} from '@/app/lib/server/tow-share-links'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = {
  params: Promise<{ token: string }>
}

export const metadata: Metadata = {
  title: 'תמונות',
  robots: { index: false, follow: false },
}

function InvalidLinkMessage() {
  return (
    <main className="min-h-full flex items-center justify-center bg-gray-50 px-4 py-16">
      <p className="text-center text-gray-600 text-base leading-relaxed max-w-sm">
        הקישור אינו תקף או שפג תוקפו
      </p>
    </main>
  )
}

export default async function PublicTowSharePage({ params }: PageProps) {
  const { token } = await params
  const link = await getValidShareLink(token ?? '')

  if (!link) {
    return <InvalidLinkMessage />
  }

  let images: { id: string; signedUrl: string }[] = []
  try {
    images = await listTowImagesForShareGallery(link.tow_id)
  } catch (err) {
    console.error('[share-gallery] image load failed', err)
    return (
      <main className="min-h-full flex items-center justify-center bg-gray-50 px-4 py-16">
        <p className="text-center text-gray-600 text-base">
          לא ניתן להציג את התמונות כרגע
        </p>
      </main>
    )
  }

  const downloadHref = `/api/share/tow/${encodeURIComponent(token)}/download`

  return (
    <main className="min-h-full bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-gray-800">תמונות</h1>
          {images.length > 0 && (
            <a
              href={downloadHref}
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              הורד הכל
            </a>
          )}
        </div>

        {images.length === 0 ? (
          <p className="text-center text-gray-500 py-16 text-sm">אין תמונות</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {images.map((img) => (
              <a
                key={img.id}
                href={img.signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-square overflow-hidden rounded-xl bg-gray-200 border border-gray-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.signedUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
