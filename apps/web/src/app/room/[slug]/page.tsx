import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, MapPin, Phone, PlayCircle, ShieldCheck, Star } from 'lucide-react';
import { formatINR, PROPERTY_AMENITY_LABEL, ROOM_AMENITY_LABEL, SHARING_LABEL } from '@thikano/domain';
import { availabilityLabel, RoomCard, StatusPill } from '@thikano/web-ui';
import { getPublicRoomBySlug } from '@thikano/server/public';
import { Footer, TopBar } from '@/components/chrome';
import { Gallery } from '@/components/gallery';
import { InterestPanel, ViewTracker } from '@/components/interest-form';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ src?: string }> };

// Availability is live: render per request, cache briefly.
export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getPublicRoomBySlug((await params).slug);
  if (!data) return { title: 'Room not available', robots: { index: false } };
  const { room, property } = data;
  const title = `${property.name} — Room ${room.number}`;
  const description = `${SHARING_LABEL[room.sharing]} · ${formatINR(room.rent)}/month · ${room.availableBeds > 0 ? availabilityLabel(room.availableBeds, room.totalBeds).text : 'Currently full'} · ${property.locality}, ${property.city}`;
  return {
    title,
    description,
    alternates: { canonical: `/room/${room.slug}` },
    openGraph: { title, description, type: 'website', url: `/room/${room.slug}` },
    twitter: { card: 'summary_large_image', title, description },
    robots: room.listingStatus === 'published' ? undefined : { index: false },
  };
}

export default async function RoomPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { src } = await searchParams;
  const data = await getPublicRoomBySlug(slug);
  if (!data) notFound();
  const { room, property, others } = data;
  const avail = availabilityLabel(room.availableBeds, room.totalBeds);
  const full = room.listingStatus !== 'published' || room.availableBeds === 0;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Accommodation',
    name: `${property.name} — Room ${room.number}`,
    occupancy: { '@type': 'QuantitativeValue', maxValue: room.totalBeds },
    amenityFeature: room.roomAmenities.map((a) => ({ '@type': 'LocationFeatureSpecification', name: ROOM_AMENITY_LABEL[a], value: true })),
    address: { '@type': 'PostalAddress', addressLocality: property.locality, addressRegion: property.city, addressCountry: 'IN' },
    offers: { '@type': 'Offer', price: room.rent / 100, priceCurrency: 'INR', availability: full ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock' },
  };

  return (
    <>
      <TopBar />
      <ViewTracker slug={room.slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-4 md:pb-10">
        <Gallery photos={room.photoUrls} alt={`Room ${room.number}`} />

        <div className="mt-6 grid gap-8 md:grid-cols-[1fr_340px]">
          <div>
            <Link href={`/pg/${property.slug}`} className="text-[12.5px] font-semibold uppercase tracking-wider text-ink-400 hover:text-navy-700">
              {property.name}
            </Link>
            <h1 className="mt-1 text-[30px] font-extrabold leading-tight">Room {room.number}</h1>
            <p className="text-[15px] text-ink-500">{SHARING_LABEL[room.sharing]}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="tabular font-display text-[26px] font-bold">
                {formatINR(room.rent)}
                <span className="text-[14px] font-medium text-ink-500"> / month</span>
              </p>
              <StatusPill tone={full ? 'navy' : avail.tone}>{full ? 'Currently full' : avail.text}</StatusPill>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] text-ink-500">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={15} /> {property.locality}, {property.city}
              </span>
              {property.rating ? (
                <span className="inline-flex items-center gap-1.5">
                  <Star size={15} className="fill-accent-500 text-accent-500" /> {property.rating}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5 text-ok-600">
                <ShieldCheck size={15} /> Verified by Habistat
              </span>
            </div>

            {room.videoUrl ? (
              <Section title="Room walkthrough">
                <video src={room.videoUrl} controls preload="none" className="w-full rounded-2xl bg-black" poster={room.photoUrls[0]}>
                  <track kind="captions" />
                </video>
                <p className="mt-1 flex items-center gap-1 text-[12px] text-ink-400">
                  <PlayCircle size={13} /> Recorded by the owner
                </p>
              </Section>
            ) : null}
            <Section title="In this room">
              <Amenities items={room.roomAmenities.map((a) => ROOM_AMENITY_LABEL[a])} />
            </Section>
            <Section title="At the property">
              <Amenities items={room.propertyAmenities.map((a) => PROPERTY_AMENITY_LABEL[a])} />
            </Section>
            <Section title="Costs">
              <dl className="grid grid-cols-2 gap-3 text-[14px]">
                <Cost label="Monthly rent (per bed)" value={formatINR(room.rent)} />
                <Cost label="Security deposit" value={formatINR(room.deposit)} />
                <Cost label="Food" value={room.foodIncluded ? 'Included' : 'Not included'} />
                <Cost label="Beds in room" value={String(room.totalBeds)} />
              </dl>
            </Section>
            <Section title="About the property">
              <p className="text-[14.5px] leading-relaxed text-ink-700">{property.description}</p>
              {property.nearbyColleges.length ? <p className="mt-3 text-[13.5px] text-ink-500">Near {property.nearbyColleges.join(', ')}</p> : null}
            </Section>
            {property.rules.length ? (
              <Section title="House rules">
                <ul className="space-y-1.5 text-[14px] text-ink-700">
                  {property.rules.map((r) => (
                    <li key={r}>• {r}</li>
                  ))}
                </ul>
              </Section>
            ) : null}
            <Section title="Location">
              <p className="text-[14px] text-ink-700">
                {property.locality}, {property.city}. The exact address is shared by the owner when you schedule a visit.
              </p>
            </Section>
          </div>

          <aside id="interest" className="scroll-mt-20 md:sticky md:top-20 md:self-start">
            {full ? (
              <div className="rounded-2xl border border-line bg-surface p-5">
                <p className="font-display text-[16px] font-bold">This room is currently full</p>
                <p className="mt-1 text-[13.5px] text-ink-500">{property.availableBeds > 0 ? `${property.name} has ${property.availableBeds} other beds available.` : 'Check back soon.'}</p>
                <Link href={`/pg/${property.slug}`} className="mt-4 inline-block text-[14px] font-semibold text-navy-700">
                  See available rooms →
                </Link>
              </div>
            ) : (
              <>
                <InterestPanel slug={room.slug} roomLabel={`Room ${room.number}`} source={src === 'qr' ? 'qr' : undefined} />
                {property.contactPhone ? (
                  <a href={`tel:${property.contactPhone}`} className="mt-3 flex items-center justify-center gap-2 text-[13.5px] font-semibold text-navy-700">
                    <Phone size={14} /> Call the owner
                  </a>
                ) : null}
              </>
            )}
          </aside>
        </div>

        {others.length ? (
          <section className="mt-12">
            <h2 className="mb-4 text-[18px] font-bold">More rooms at {property.name}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {others.slice(0, 3).map((r) => (
                <RoomCard key={r.roomId} href={`/room/${r.slug}`} room={{ number: r.number, sharing: r.sharing, rent: r.rent, availableBeds: r.availableBeds, totalBeds: r.totalBeds, amenities: r.roomAmenities, photoUrl: r.coverPhotoUrl }} />
              ))}
            </div>
          </section>
        ) : null}
      </main>
      {full ? null : (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="tabular font-display text-[17px] font-bold leading-tight">
                {formatINR(room.rent)}
                <span className="text-[12px] font-medium text-ink-500"> /month</span>
              </p>
              <p className="text-[12px] font-semibold text-ok-600">{avail.text}</p>
            </div>
            <a href="#interest" className="inline-flex h-11 items-center rounded-lg bg-navy-700 px-5 text-[14px] font-semibold text-white">
              I&apos;m interested
            </a>
          </div>
        </div>
      )}
      <Footer />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-line pt-6">
      <h2 className="mb-3 text-[16px] font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Amenities({ items }: { items: string[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((a) => (
        <li key={a} className="flex items-center gap-2 text-[14px] text-ink-700">
          <Check size={15} className="text-ok-600" /> {a}
        </li>
      ))}
    </ul>
  );
}

function Cost({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-3 ring-1 ring-line">
      <dt className="text-[12px] text-ink-500">{label}</dt>
      <dd className="tabular mt-0.5 font-semibold">{value}</dd>
    </div>
  );
}
