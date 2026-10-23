/**
 * Critical journeys in real browsers against the seeded emulators (spec §81–85).
 * Serial: each step builds on the previous one (Room 204 is listed, then enquired, …).
 */
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const FIRESTORE = 'http://127.0.0.1:8080/v1/projects/demo-thikano/databases/(default)/documents';
async function publicRoom(id: string) {
  const r = await fetch(`${FIRESTORE}/publicRooms/${id}`, { headers: { authorization: 'Bearer owner' } });
  return r.ok ? ((await r.json()) as { fields: Record<string, { integerValue?: string; stringValue?: string }> }) : null;
}
async function signIn(page: Page, base: string, email: string) {
  await page.goto(`${base}/login`);
  await page.fill('#email', email);
  await page.fill('#password', 'thikano-dev-123');
  await page.click('button[type=submit]');
}

test('owner lists a vacant room and availability follows bed assignment', async ({ page }) => {
  expect(await publicRoom('prop-sunrise-r204')).toBeNull();
  await signIn(page, 'http://localhost:3001', 'shashank@thikano.dev');
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), Shashank/ })).toBeVisible();

  await page.goto('http://localhost:3001/rooms/prop-sunrise-r204');
  await page.getByRole('button', { name: 'List on THIKANO' }).click();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByRole('button', { name: 'Listed' })).toBeVisible();
  await expect.poll(async () => (await publicRoom('prop-sunrise-r204'))?.fields.availableBeds?.integerValue, { timeout: 30_000 }).toBe('2');

  await page.getByRole('button', { name: 'Assign' }).first().click();
  await page.fill('input[name=name]', 'Ishaan Mehta');
  await page.fill('input[name=phone]', '9812345678');
  await page.getByRole('button', { name: 'Assign bed' }).click();
  await expect(page.getByText('Ishaan Mehta')).toBeVisible();
  await expect.poll(async () => (await publicRoom('prop-sunrise-r204'))?.fields.availableBeds?.integerValue, { timeout: 30_000 }).toBe('1');
});

test('student enquires from the shared link without an app; owner sees the lead', async ({ browser }) => {
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await phone.goto('http://localhost:3000/room/sunrise-pg-room-204');
  await expect(phone.getByRole('heading', { name: 'Room 204' })).toBeVisible();
  expect(await phone.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await phone.locator('a[href="#interest"]').click();
  await phone.getByRole('button', { name: "I'm interested" }).click();
  await phone.fill('input[name=name]', 'Ananya Gupta');
  await phone.fill('input[name=phone]', '9876501234');
  await phone.getByRole('button', { name: 'Send' }).click();
  await expect(phone.getByText('Request sent ✓')).toBeVisible();

  const owner = await browser.newPage();
  await signIn(owner, 'http://localhost:3001', 'shashank@thikano.dev');
  await owner.waitForURL('http://localhost:3001/');
  await owner.goto('http://localhost:3001/leads');
  await expect(owner.getByText('Ananya Gupta')).toBeVisible();
});

test('public pages hide unlisted rooms and expose SEO metadata', async ({ page, request }) => {
  expect((await request.get('http://localhost:3000/room/sunrise-pg-room-101')).status()).toBe(404);
  await page.goto('http://localhost:3000/pg/sunrise-pg-kukas');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Sunrise PG/);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  const sitemap = await (await request.get('http://localhost:3000/sitemap.xml')).text();
  expect(sitemap).toContain('/room/sunrise-pg-room-204');
  for (const path of ['/privacy', '/terms', '/refunds', '/contact', '/delete-account']) expect((await request.get(`http://localhost:3000${path}`)).status()).toBe(200);
});

test('admin access is restricted; approving a property makes it public', async ({ page }) => {
  await signIn(page, 'http://localhost:3002', 'shashank@thikano.dev');
  await expect(page.getByText('does not have THIKANO staff access')).toBeVisible();
  await page.context().clearCookies();

  await signIn(page, 'http://localhost:3002', 'admin@thikano.dev');
  await expect(page.getByRole('heading', { name: 'Platform overview' })).toBeVisible();
  expect(await publicRoom('prop-ananta-r101')).toBeNull();
  await page.goto('http://localhost:3002/verification');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Nothing to review')).toBeVisible();
  await expect.poll(async () => (await publicRoom('prop-ananta-r101'))?.fields.listingStatus?.stringValue ?? 'none', { timeout: 30_000 }).not.toBe('none');
  await page.goto('http://localhost:3002/audit-logs');
  await expect(page.getByText('property.verified')).toBeVisible();
});
