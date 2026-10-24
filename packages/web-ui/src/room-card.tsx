import type { ReactNode } from 'react';
import { BedDouble, Eye, ImageOff, MessageSquare } from 'lucide-react';
import { formatINR, ROOM_AMENITY_LABEL, SHARING_LABEL, type ListingStatus, type Paise, type RoomAmenity, type SharingType } from '@thikano/domain';
import { cx, StatusPill, type Tone } from './primitives';

export interface RoomCardData {
  number: string;
  sharing: SharingType;
  rent: Paise;
  availableBeds: number;
  totalBeds: number;
  amenities: RoomAmenity[];
  photoUrl?: string | null;
  /** Public context: "Sunrise PG · Kukas" */
  propertyLabel?: string;
  distanceKm?: number | null;
  stats?: { views: number; enquiries: number };
  listingStatus?: ListingStatus;
  upcomingVacancies?: number;
}

export function availabilityLabel(available: number, total: number): { text: string; tone: Tone } {
  if (total === 0) return { text: 'No beds added', tone: 'neutral' };
  if (available === 0) return { text: 'Fully occupied', tone: 'navy' };
  return { text: `${available} bed${available === 1 ? '' : 's'} available`, tone: 'ok' };
}

const LISTING_PILL: Partial<Record<ListingStatus, { text: string; tone: Tone }>> = {
  published: { text: 'Listed', tone: 'brand' },
  pending_verification: { text: 'Awaiting verification', tone: 'warn' },
  paused: { text: 'Paused', tone: 'neutral' },
  suspended: { text: 'Suspended', tone: 'bad' },
};

/**
 * The Habistat room card — reused by Owner, Discover, public pages and Admin.
 * `actions` renders the footer (View / Share / List) supplied by the host app.
 */
export function RoomCard({ room, actions, href, className }: { room: RoomCardData; actions?: ReactNode; href?: string; className?: string }) {
  const avail = availabilityLabel(room.availableBeds, room.totalBeds);
  const listing = room.listingStatus ? LISTING_PILL[room.listingStatus] : undefined;
  const body = (
    <>
      <div className="relative aspect-[16/10] overflow-hidden bg-navy-50">
        {room.photoUrl ? (
          <img src={room.photoUrl} alt={`Room ${room.number}`} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        ) : (
          <div className="grid size-full place-items-center text-navy-300">
            <ImageOff size={28} />
          </div>
        )}
        {listing ? (
          <span className="absolute left-3 top-3">
            <StatusPill tone={listing.tone}>{listing.text}</StatusPill>
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {room.propertyLabel ? <p className="mb-0.5 text-[12px] font-semibold uppercase tracking-wide text-ink-400">{room.propertyLabel}</p> : null}
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display text-[17px] font-bold text-ink-900">Room {room.number}</h3>
          {room.distanceKm != null ? <span className="text-[12.5px] text-ink-500">{room.distanceKm.toFixed(1)} km away</span> : null}
        </div>
        <p className="text-[13px] text-ink-500">{SHARING_LABEL[room.sharing]}</p>
        <p className="tabular mt-3 font-display text-[19px] font-bold text-ink-900">
          {formatINR(room.rent)}
          <span className="text-[13px] font-medium text-ink-500"> / month</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill tone={avail.tone}>{avail.text}</StatusPill>
          {room.upcomingVacancies ? (
            <span className="inline-flex items-center gap-1 text-[12px] text-warn-600">
              <BedDouble size={13} /> {room.upcomingVacancies} leaving soon
            </span>
          ) : null}
        </div>
        {room.amenities.length ? <p className="mt-3 line-clamp-1 text-[12.5px] text-ink-500">{room.amenities.slice(0, 4).map((a) => ROOM_AMENITY_LABEL[a]).join(' • ')}</p> : null}
        {room.stats ? (
          <div className="mt-3 flex gap-4 border-t border-line pt-3 text-[12.5px] text-ink-500">
            <span className="inline-flex items-center gap-1.5">
              <Eye size={14} /> <b className="tabular font-semibold text-ink-700">{room.stats.views}</b> views
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare size={14} /> <b className="tabular font-semibold text-ink-700">{room.stats.enquiries}</b> enquiries
            </span>
          </div>
        ) : null}
        {actions ? <div className="mt-auto flex flex-wrap gap-2 pt-4">{actions}</div> : null}
      </div>
    </>
  );
  const cls = cx('group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]', className);
  return href ? (
    <a href={href} className={cls}>
      {body}
    </a>
  ) : (
    <article className={cls}>{body}</article>
  );
}
