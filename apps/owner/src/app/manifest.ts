import type { MetadataRoute } from 'next';

/** Makes the console installable ("Install app" on Android Chrome) and backs the owner APK (TWA). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Habistat Owner',
    short_name: 'Habistat Owner',
    description: 'Run your PG, fill vacant rooms, manage residents, and earn more.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFFFFF',
    theme_color: '#011C5B',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
