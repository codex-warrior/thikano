import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_PUBLIC_WEB_URL ?? 'https://habistat.com';

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/qr/', '/api/'] }], sitemap: `${BASE}/sitemap.xml` };
}
