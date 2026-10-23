import './app';
import { getFirestore } from 'firebase-admin/firestore';
import { groupByProperty, searchRooms, type PublicProperty, type PublicRoom } from '@thikano/domain';

/**
 * PUBLIC repository — may only read the public projections (publicRooms,
 * publicProperties, slugs). Never import owner/platform repositories into public pages.
 */
const db = () => getFirestore();

export async function getPublicRoomBySlug(slug: string): Promise<{ room: PublicRoom; property: PublicProperty; others: PublicRoom[] } | null> {
  const snap = await db().collection('publicRooms').where('slug', '==', slug).limit(1).get();
  if (snap.empty) return null;
  const room = snap.docs[0]!.data() as PublicRoom;
  const prop = await db().doc(`publicProperties/${room.propertyId}`).get();
  if (!prop.exists) return null;
  const others = await db().collection('publicRooms').where('propertyId', '==', room.propertyId).where('listingStatus', '==', 'published').limit(12).get();
  return { room, property: prop.data() as PublicProperty, others: others.docs.map((d) => d.data() as PublicRoom).filter((r) => r.roomId !== room.roomId) };
}

export async function getPublicPropertyBySlug(slug: string): Promise<{ property: PublicProperty; rooms: PublicRoom[] } | null> {
  const snap = await db().collection('publicProperties').where('slug', '==', slug).limit(1).get();
  if (snap.empty) return null;
  const property = snap.docs[0]!.data() as PublicProperty;
  const rooms = await db().collection('publicRooms').where('propertyId', '==', property.propertyId).where('listingStatus', '==', 'published').limit(100).get();
  return { property, rooms: rooms.docs.map((d) => d.data() as PublicRoom).sort((a, b) => a.rent - b.rent) };
}

/** Home page: verified properties with real availability, best first. */
export async function getFeaturedProperties(limit = 12) {
  const snap = await db().collection('publicRooms').where('listingStatus', '==', 'published').limit(400).get();
  return groupByProperty(searchRooms(snap.docs.map((d) => d.data() as PublicRoom), {}, 'relevance')).slice(0, limit);
}

export async function getAllPublicSlugs(): Promise<{ rooms: string[]; properties: string[] }> {
  const [rooms, props] = await Promise.all([db().collection('publicRooms').select('slug').limit(5000).get(), db().collection('publicProperties').select('slug').limit(2000).get()]);
  return { rooms: rooms.docs.map((d) => d.get('slug') as string), properties: props.docs.map((d) => d.get('slug') as string) };
}
