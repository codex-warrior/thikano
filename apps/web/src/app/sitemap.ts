import type { MetadataRoute } from 'next';
import { getAllPublicSlugs } from '@thikano/server/public';

const BASE = process.env.NEXT_PUBLIC_PUBLIC_WEB_URL ?? 'https://thikano.in';
export const dynamic = 'force-dynamic';

/** Only public, verified properties and published rooms are indexable. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { rooms, properties } = await getAllPublicSlugs();
  return [
    { url: BASE, changeFrequency: 'daily', priority: 1 },
    ...properties.map((s) => ({ url: `${BASE}/pg/${s}`, changeFrequency: 'daily' as const, priority: 0.8 })),
    ...rooms.map((s) => ({ url: `${BASE}/room/${s}`, changeFrequency: 'daily' as const, priority: 0.6 })),
  ];
}
