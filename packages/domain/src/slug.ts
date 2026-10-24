/** "Sunrise PG", "Kukas" → "sunrise-pg-kukas" */
export function slugify(...parts: string[]): string {
  return parts
    .join(' ')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function propertySlug(name: string, locality: string): string {
  return slugify(name, locality);
}

export function roomSlug(propertyName: string, roomNumber: string): string {
  return slugify(propertyName, 'room', roomNumber);
}

/** Disambiguate a taken slug with a short suffix: sunrise-pg-kukas-2 */
export function withSuffix(slug: string, n: number): string {
  return n <= 1 ? slug : `${slug}-${n}`;
}

export const PUBLIC_BASE_URL = 'https://habistat.com';
export const publicPropertyUrl = (slug: string, base = PUBLIC_BASE_URL) => `${base}/pg/${slug}`;
export const publicRoomUrl = (slug: string, base = PUBLIC_BASE_URL) => `${base}/room/${slug}`;
