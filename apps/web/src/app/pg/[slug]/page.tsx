import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Check, MapPin, ShieldCheck, Star } from 'lucide-react';
import { formatINR, PROPERTY_AMENITY_LABEL } from '@thikano/domain';
import { EmptyState, RoomCard, StatusPill } from '@thikano/web-ui';
import { getPublicPropertyBySlug } from '@thikano/server/public';
import { Footer, TopBar } from '@/components/chrome';
import { Gallery } from '@/components/gallery';
import { InterestPanel } from '@/components/interest-form';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ src?: string }> };

export const revalidate = 60;

const GENDER = { boys: 'Boys', girls: 'Girls', coed: 'Co-living' } as const;
const KIND = { pg: 'PG', hostel: 'Hostel', student_housing: 'Student housing' } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getPublicPropertyBySlug((await params).slug);
  if (!data) return { title: 'PG not found', robots: { index: false } };
  const p = data.property;
  const title = `${p.name}, ${p.locality} — ${GENDER[p.genderRule]} ${KIND[p.kind]}`;
  const description = `${p.availableBeds} beds available${p.startingRent ? ` from ${formatINR(p.startingRent)}/month` : ''}. ${p.description}`;
  return {
    title,
    description,
    alternates: { canonical: `/pg/${p.slug}` },
    openGraph: { title, description, images: p.photoUrls.slice(0, 1), url: `/pg/${p.slug}` },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function PropertyPage({ params, searchParams }: Props) {
  const { src } = await searchParams;
  const data = await getPublicPropertyBySlug((await params).slug);
  if (!data) notFound();
  const { property: p, rooms } = data;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: p.name,
    description: p.description,
    image: p.photoUrls,
    address: { '@type': 'PostalAddress', addressLocality: p.locality, addressRegion: p.city, addressCountry: 'IN' },
    ...(p.rating ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, ratingCount: p.ratingCount, bestRating: 5 } } : {}),
    ...(p.startingRent ? { priceRange: `From ₹${p.startingRent / 100}/month` } : {}),
  };

  return (
    <>
      <TopBar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto max-w-5xl px-4 pt-4">
        <Gallery photos={p.photoUrls} alt={p.name} />
        <div className="mt-6 grid gap-8 md:grid-cols-[1fr_340px]">
          <div>
            <p className="text-[12.5px] font-semibold uppercase tracking-wider text-ink-400">
              {GENDER[p.genderRule]} {KIND[p.kind]}
            </p>
            <h1 className="mt-1 text-[30px] font-extrabold leading-tight">{p.name}</h1>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] text-ink-500">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={15} /> {p.locality}, {p.city}
              </span>
              {p.rating ? (
                <span className="inline-flex items-center gap-1.5">
                  <Star size={15} className="fill-marigold-500 text-marigold-500" /> {p.rating} ({p.ratingCount})
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5 text-ok-600">
                <ShieldCheck size={15} /> Verified by THIKANO
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {p.startingRent ? (
                <p className="font-display text-[22px] font-bold">
                  <span className="text-[14px] font-medium text-ink-500">Starting from </span>
                  {formatINR(p.startingRent)}
                  <span className="text-[14px] font-medium text-ink-500">/month</span>
                </p>
              ) : null}
              <StatusPill tone={p.availableBeds ? 'ok' : 'navy'}>{p.availableBeds ? `${p.availableBeds} beds available` : 'Currently full'}</StatusPill>
            </div>
            <section className="mt-8">
              <h2 className="mb-3 text-[16px] font-bold">Amenities</h2>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {p.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2 text-[14px] text-ink-700">
                    <Check size={15} className="text-ok-600" /> {PROPERTY_AMENITY_LABEL[a]}
                  </li>
                ))}
              </ul>
            </section>
          </div>
          {p.availableBeds > 0 ? (
            <aside className="md:sticky md:top-20 md:self-start">
              <InterestPanel slug={p.slug} roomLabel={p.name} source={src === 'qr' ? 'qr' : undefined} />
            </aside>
          ) : null}
        </div>

        <section className="mt-10">
          <h2 className="mb-4 text-[18px] font-bold">Available rooms</h2>
          {rooms.length === 0 ? (
            <EmptyState title="No rooms available right now" body="This property is fully occupied. Check back soon." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((r) => (
                <RoomCard key={r.roomId} href={`/room/${r.slug}${src === 'qr' ? '?src=qr' : ''}`} room={{ number: r.number, sharing: r.sharing, rent: r.rent, availableBeds: r.availableBeds, totalBeds: r.totalBeds, amenities: r.roomAmenities, photoUrl: r.coverPhotoUrl }} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-10 grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="mb-3 text-[16px] font-bold">About</h2>
            <p className="text-[14.5px] leading-relaxed text-ink-700">{p.description}</p>
            {p.nearbyColleges.length ? <p className="mt-3 text-[13.5px] text-ink-500">Near {p.nearbyColleges.join(', ')}</p> : null}
          </div>
          {p.rules.length ? (
            <div>
              <h2 className="mb-3 text-[16px] font-bold">House rules</h2>
              <ul className="space-y-1.5 text-[14px] text-ink-700">
                {p.rules.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </main>
      <Footer />
    </>
  );
}
