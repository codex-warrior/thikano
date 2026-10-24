import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { formatINR, SHARING_LABEL } from '@thikano/domain';
import { getPublicPropertyBySlug, getPublicRoomBySlug } from '@thikano/server/public';
import { Logo } from '@thikano/web-ui';
import { PrintButton } from '@/components/print-button';

export const metadata = { title: 'QR poster', robots: { index: false } };

const BASE = process.env.NEXT_PUBLIC_PUBLIC_WEB_URL ?? 'https://habistat.com';

/** Printable A4 poster: "Scan to view available rooms". The QR opens the public page with ?src=qr. */
export default async function QrPoster({ params }: { params: Promise<{ kind: string; slug: string }> }) {
  const { kind, slug } = await params;
  let title: string;
  let subtitle: string;
  let url: string;
  if (kind === 'pg') {
    const d = await getPublicPropertyBySlug(slug);
    if (!d) notFound();
    title = d.property.name;
    subtitle = d.property.startingRent ? `Rooms from ${formatINR(d.property.startingRent)}/month · ${d.property.locality}` : d.property.locality;
    url = `${BASE}/pg/${slug}?src=qr`;
  } else if (kind === 'room') {
    const d = await getPublicRoomBySlug(slug);
    if (!d) notFound();
    title = `${d.property.name} · Room ${d.room.number}`;
    subtitle = `${SHARING_LABEL[d.room.sharing]} · ${formatINR(d.room.rent)}/month`;
    url = `${BASE}/room/${slug}?src=qr`;
  } else notFound();
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#011C5B', light: '#FFFFFF' }, errorCorrectionLevel: 'M' });

  return (
    <main className="mx-auto flex min-h-dvh max-w-[210mm] flex-col items-center justify-center bg-white p-10 text-center print:p-0">
      <Logo size="lg" />
      <h1 className="mt-10 font-display text-[40px] font-extrabold uppercase leading-tight tracking-wide text-navy-900">Scan to view available rooms</h1>
      <div className="mt-10 w-[300px]" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="mt-10 font-display text-[30px] font-bold text-ink-900">{title}</p>
      <p className="mt-2 text-[17px] text-ink-500">{subtitle}</p>
      <p className="mt-8 text-[13px] text-ink-400">See real photos, rent and live availability · Powered by Habistat</p>
      <PrintButton />
    </main>
  );
}
