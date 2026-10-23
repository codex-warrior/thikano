import { ImageResponse } from 'next/og';
import { formatINR, SHARING_LABEL } from '@thikano/domain';
import { getPublicRoomBySlug } from '@thikano/server/public';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Room on THIKANO';

/** WhatsApp / social preview: room photo + rent + live availability + THIKANO mark. */
export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const data = await getPublicRoomBySlug((await params).slug);
  const room = data?.room;
  const property = data?.property;
  const avail = room ? (room.availableBeds > 0 && room.listingStatus === 'published' ? `${room.availableBeds} bed${room.availableBeds === 1 ? '' : 's'} available` : 'Currently full') : '';

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: '#0B1633', color: 'white', fontFamily: 'sans-serif' }}>
        {room?.photoUrls[0] ? <img src={room.photoUrls[0]} width={630} height={630} style={{ objectFit: 'cover' }} alt="" /> : <div style={{ width: 630, height: 630, background: '#1A2D5E' }} />}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 56, flex: 1 }}>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 6, display: 'flex' }}>
            THIKANO<span style={{ color: '#D99A2B' }}>.</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 26, color: '#93A3C8', textTransform: 'uppercase', letterSpacing: 2 }}>{property?.name ?? ''}</div>
            <div style={{ fontSize: 64, fontWeight: 800, marginTop: 8 }}>{`Room ${room?.number ?? ''}`}</div>
            <div style={{ fontSize: 30, color: '#C3CDE3', marginTop: 4 }}>{room ? SHARING_LABEL[room.sharing] : ''}</div>
            <div style={{ fontSize: 48, fontWeight: 800, marginTop: 28 }}>{room ? `${formatINR(room.rent)}/month` : ''}</div>
            <div style={{ display: 'flex', marginTop: 20 }}>
              <div style={{ fontSize: 26, background: '#E3F3EA', color: '#1C7A50', padding: '8px 18px', borderRadius: 999, fontWeight: 700 }}>{avail}</div>
            </div>
          </div>
          <div style={{ fontSize: 22, color: '#93A3C8' }}>{property ? `${property.locality}, ${property.city}` : ''}</div>
        </div>
      </div>
    ),
    size,
  );
}
