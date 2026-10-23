import Link from 'next/link';
import { GraduationCap, MapPin, Star } from 'lucide-react';
import { formatINR } from '@thikano/domain';
import { Card } from '@thikano/web-ui';
import { getFeaturedProperties } from '@thikano/server/public';
import { Footer, TopBar } from '@/components/chrome';

// Reads live Firestore projections at request time (no build-time database access).
export const dynamic = 'force-dynamic';

export default async function Home() {
  const props = await getFeaturedProperties();
  const totalRooms = props.reduce((a, p) => a + p.rooms.length, 0);

  return (
    <>
      <TopBar />
      <main>
        <section className="bg-navy-900 text-white">
          <div className="mx-auto max-w-5xl px-4 pb-14 pt-12 md:pt-20">
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-marigold-500">For students</p>
            <h1 className="mt-3 max-w-2xl text-[36px] font-extrabold leading-[1.1] md:text-[52px]">Find your PG. See the actual room.</h1>
            <p className="mt-4 max-w-xl text-[16px] text-navy-200">Real rooms, real photos, live availability — at PGs and hostels verified by THIKANO.</p>
            <div className="mt-8 grid max-w-xl gap-2 sm:grid-cols-2">
              <div className="flex h-12 items-center gap-2 rounded-xl bg-white px-4 text-[15px] text-ink-400">
                <MapPin size={17} className="text-navy-700" /> Search area — e.g. Kukas
              </div>
              <div className="flex h-12 items-center gap-2 rounded-xl bg-white px-4 text-[15px] text-ink-400">
                <GraduationCap size={17} className="text-navy-700" /> Search college — e.g. JECRC
              </div>
            </div>
            <p className="mt-3 text-[12.5px] text-navy-300">Search with filters and maps is in the THIKANO app.</p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-10">
          <h2 className="text-[20px] font-bold">PGs with rooms available now</h2>
          <p className="mt-1 text-[14px] text-ink-500">{totalRooms} available rooms right now</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {props.map((p) => (
              <Link key={p.propertyId} href={`/pg/${p.propertySlug}`}>
                <Card className="flex overflow-hidden transition-shadow hover:shadow-[var(--shadow-raised)]">
                  {p.coverPhotoUrl ? <img src={p.coverPhotoUrl} alt="" className="w-36 shrink-0 object-cover sm:w-44" loading="lazy" /> : null}
                  <div className="flex-1 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-[17px] font-bold">{p.propertyName}</h3>
                      {p.rating ? (
                        <span className="inline-flex items-center gap-1 text-[13px] font-semibold">
                          <Star size={13} className="fill-marigold-500 text-marigold-500" /> {p.rating}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[13px] text-ink-500">{p.locality}</p>
                    <p className="mt-3 text-[13px] text-ink-500">Starting from</p>
                    <p className="tabular font-display text-[18px] font-bold">{formatINR(p.startingRent)}/month</p>
                    <p className="mt-2 text-[13px] font-semibold text-ok-600">🟢 {p.availableBeds} beds available</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
