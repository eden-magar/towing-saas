import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'מגרר - MAGRAR',
    short_name: 'מגרר',
    description: 'מערכת ניהול גרירות',
    start_url: '/',
    display: 'standalone',
    background_color: '#0d1b3e',
    theme_color: '#0d1b3e',
    orientation: 'portrait-primary',
    lang: 'he',
    dir: 'rtl',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
