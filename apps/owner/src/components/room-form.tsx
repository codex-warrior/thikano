'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ImagePlus, Loader2, Trash2, Video } from 'lucide-react';
import { doc, writeBatch } from 'firebase/firestore';
import { ROOM_AMENITY_LABEL, SHARING_LABEL, type Building, type Floor, type MediaAsset, type Room, type RoomAmenity, type SharingType } from '@thikano/domain';
import { Button, Card } from '@thikano/web-ui';
import { uploadPhoto, uploadVideo } from '@/lib/media';
import { newId, useMutation } from '@/lib/use-mutation';
import { CheckGroup, Field, FormError, MoneyField, rupeesToPaise, Select, TextArea } from './form';

const BEDS_FOR: Record<SharingType, number> = { single: 1, double: 2, triple: 3, quad: 4, dorm: 6 };
const LABELS = 'ABCDEFGHIJ';

function floorLabel(level: number): string {
  if (level === 0) return 'Ground';
  const teen = level % 100 >= 11 && level % 100 <= 13;
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[level % 10] ?? 'th';
  return `${level}${suffix}`;
}

interface Props {
  orgId: string;
  propertyId: string;
  uid: string;
  buildings: Building[];
  floors: Floor[];
  room?: Room | null;
}

/**
 * Add / edit room. Creates the room + its beds in one rules-validated batch; slug and
 * availability are derived server-side (onRoomWritten / onBedWritten).
 */
export function RoomForm({ orgId, propertyId, uid, buildings, floors, room }: Props) {
  const router = useRouter();
  const editing = !!room;
  const [sharing, setSharing] = useState<SharingType>(room?.sharing ?? 'double');
  const [buildingId, setBuildingId] = useState(room?.buildingId ?? buildings[0]?.id ?? '__new');
  const [photos, setPhotos] = useState<MediaAsset[]>(room?.photos ?? []);
  const [videos, setVideos] = useState<MediaAsset[]>(room?.videos ?? []);
  const [uploading, setUploading] = useState(0);
  const [videoPct, setVideoPct] = useState<number | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const floorsForBuilding = floors.filter((f) => f.buildingId === buildingId);

  const save = useMutation(async (fb, form: FormData) => {
    const t = Date.now();
    const batch = writeBatch(fb.db);
    const base = `organizations/${orgId}/properties/${propertyId}`;
    let bId = String(form.get('buildingId'));
    let fId = String(form.get('floorId') ?? '');
    if (bId === '__new') {
      bId = newId('bld');
      batch.set(doc(fb.db, `${base}/buildings/${bId}`), { id: bId, orgId, propertyId, name: String(form.get('newBuilding') || 'Main'), sortOrder: buildings.length, createdAt: t, updatedAt: t, createdBy: uid });
      fId = '__new';
    }
    if (!fId || fId === '__new') {
      const level = Number(form.get('newFloorLevel') ?? 0);
      fId = newId('flr');
      batch.set(doc(fb.db, `${base}/floors/${fId}`), { id: fId, orgId, propertyId, buildingId: bId, level, label: floorLabel(level), createdAt: t, updatedAt: t, createdBy: uid });
    }
    const fields = {
      number: String(form.get('number')).trim(),
      sharing,
      description: String(form.get('description') ?? '').trim(),
      rent: rupeesToPaise(form.get('rent')),
      deposit: rupeesToPaise(form.get('deposit')),
      amenities: form.getAll('amenities').map(String) as RoomAmenity[],
      photos: photos.map((p, i) => ({ ...p, sortOrder: i })),
      videos,
      buildingId: bId,
      floorId: fId,
      operationalStatus: (form.get('operationalStatus') as Room['operationalStatus']) ?? 'active',
      updatedAt: t,
    };
    if (!editing) {
      const roomId = newId('room');
      batch.set(doc(fb.db, `${base}/rooms/${roomId}`), { id: roomId, orgId, propertyId, ...fields, listingIntent: 'unlisted', createdAt: t, createdBy: uid });
      for (let i = 0; i < BEDS_FOR[sharing]; i++) {
        const bedId = `${roomId}-${LABELS[i]}`;
        batch.set(doc(fb.db, `${base}/beds/${bedId}`), { id: bedId, orgId, propertyId, roomId, label: LABELS[i], status: 'available', residentId: null, rentOverride: null, moveInDate: null, moveOutDate: null, createdAt: t, updatedAt: t, createdBy: uid });
      }
      await batch.commit();
      return roomId;
    }
    batch.update(doc(fb.db, `${base}/rooms/${room!.id}`), fields);
    await batch.commit();
    return room!.id;
  });

  async function onPhotos(files: FileList | null) {
    if (!files?.length) return;
    setLocalError(null);
    const list = [...files].slice(0, 12 - photos.length);
    setUploading((n) => n + list.length);
    for (const file of list) {
      try {
        const asset = await uploadPhoto(orgId, propertyId, file, photos.length);
        setPhotos((p) => [...p, asset]);
      } catch {
        setLocalError("One photo couldn't be uploaded. Please try again.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  async function onVideo(file: File | undefined) {
    if (!file) return;
    if (file.size > 60 * 1024 * 1024) return setVideoError('Videos up to 60 MB (about 30–60 seconds).');
    setVideoError(null);
    setVideoPct(0);
    try {
      const asset = await uploadVideo(orgId, propertyId, file, setVideoPct);
      setVideos([asset]);
    } catch {
      setVideoError("The video didn't upload. You can save the room and add it later.");
    } finally {
      setVideoPct(null);
    }
  }

  return (
    <form
      className="grid gap-6 lg:grid-cols-[1.4fr_1fr]"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        if (!String(form.get('number')).trim()) return setLocalError('Please enter the room number.');
        if (!Number.isFinite(rupeesToPaise(form.get('rent'))) || rupeesToPaise(form.get('rent')) <= 0) return setLocalError('Please enter the monthly rent.');
        if (!Number.isFinite(rupeesToPaise(form.get('deposit')))) return setLocalError('Please enter the security deposit (0 if none).');
        if (uploading > 0) return setLocalError('Please wait for photos to finish uploading.');
        const id = await save.run(form);
        if (id) router.push(`/rooms/${id}`);
      }}
    >
      <div className="space-y-6">
        <Card className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Room number" name="number" defaultValue={room?.number} placeholder="204" required maxLength={12} />
            <Select label="Room type" name="sharing" value={sharing} onChange={(e) => setSharing(e.target.value as SharingType)} disabled={editing}>
              {(Object.keys(SHARING_LABEL) as SharingType[]).map((s) => (
                <option key={s} value={s}>
                  {SHARING_LABEL[s]} ({BEDS_FOR[s]} bed{BEDS_FOR[s] === 1 ? '' : 's'})
                </option>
              ))}
            </Select>
            <MoneyField label="Monthly rent (per bed)" name="rent" defaultValue={room ? room.rent / 100 : ''} placeholder="9500" required />
            <MoneyField label="Security deposit" name="deposit" defaultValue={room ? room.deposit / 100 : ''} placeholder="10000" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Building" name="buildingId" value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
              <option value="__new">+ New building</option>
            </Select>
            {buildingId === '__new' ? (
              <Field label="Building name" name="newBuilding" placeholder="Block A" />
            ) : (
              <Select label="Floor" name="floorId" defaultValue={room?.floorId ?? floorsForBuilding[0]?.id ?? '__new'}>
                {floorsForBuilding.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label} floor
                  </option>
                ))}
                <option value="__new">+ New floor</option>
              </Select>
            )}
          </div>
          <Field label="New floor number (if adding a floor)" name="newFloorLevel" type="number" min={0} max={60} defaultValue={2} hint="0 = Ground floor. Ignored when an existing floor is selected." />
          <TextArea label="Description" name="description" rows={3} defaultValue={room?.description} placeholder="Bright double room with balcony, study tables and wardrobe for each student." maxLength={600} />
          {editing ? (
            <Select label="Status" name="operationalStatus" defaultValue={room!.operationalStatus}>
              <option value="active">Active</option>
              <option value="maintenance">Under maintenance (hidden from students)</option>
              <option value="inactive">Inactive</option>
            </Select>
          ) : null}
        </Card>
        <Card className="p-5">
          <CheckGroup label="Amenities" name="amenities" options={(Object.keys(ROOM_AMENITY_LABEL) as RoomAmenity[]).map((a) => ({ value: a, label: ROOM_AMENITY_LABEL[a] }))} defaultValue={room?.amenities ?? ['wifi', 'study_table', 'cupboard']} />
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="p-5">
          <p className="text-[13px] font-semibold text-ink-700">Photos</p>
          <p className="text-[12px] text-ink-400">Students decide on photos. Add 3–8 clear, bright pictures.</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg bg-navy-50">
                <img src={p.thumbUrl ?? p.url} alt={`Photo ${i + 1}`} className="size-full object-cover" />
                {i === 0 ? <span className="absolute left-1 top-1 rounded bg-navy-900/80 px-1.5 text-[10px] font-semibold text-white">Cover</span> : null}
                <button type="button" onClick={() => setPhotos((ps) => ps.filter((x) => x.id !== p.id))} className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-white/90 text-bad-600 opacity-0 transition-opacity group-hover:opacity-100" aria-label="Remove photo">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {Array.from({ length: uploading }).map((_, i) => (
              <div key={`u${i}`} className="grid aspect-square place-items-center rounded-lg bg-navy-50 text-navy-500">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ))}
            {photos.length < 12 ? (
              <label className="grid aspect-square cursor-pointer place-items-center rounded-lg border border-dashed border-line-strong text-ink-400 hover:border-navy-500 hover:text-navy-700">
                <span className="flex flex-col items-center gap-1 text-[12px] font-semibold">
                  <ImagePlus size={20} /> Add photo
                </span>
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => onPhotos(e.target.files)} />
              </label>
            ) : null}
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-[13px] font-semibold text-ink-700">Walkthrough video <span className="font-normal text-ink-400">(optional)</span></p>
          {videos[0] ? (
            <div className="mt-3 flex items-center gap-3">
              <video src={videos[0].url} className="h-20 rounded-lg bg-black" muted />
              <button type="button" className="text-[13px] font-semibold text-bad-600" onClick={() => setVideos([])}>
                Remove
              </button>
            </div>
          ) : (
            <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line-strong px-3 py-3 text-[13px] font-semibold text-ink-500 hover:border-navy-500">
              <Video size={16} /> {videoPct != null ? `Uploading… ${videoPct}%` : 'Add a 30-second walkthrough'}
              <input type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" disabled={videoPct != null} onChange={(e) => onVideo(e.target.files?.[0])} />
            </label>
          )}
          {videoError ? <p className="mt-2 text-[12.5px] text-warn-600">{videoError}</p> : null}
        </Card>
        {!editing ? (
          <Card className="p-5">
            <p className="text-[13px] font-semibold text-ink-700">Beds</p>
            <p className="mt-1 text-[13px] text-ink-500">
              {BEDS_FOR[sharing]} bed{BEDS_FOR[sharing] === 1 ? '' : 's'} will be created ({LABELS.slice(0, BEDS_FOR[sharing]).split('').map((l) => `Bed ${l}`).join(', ')}), all available. You can add, block or remove beds later.
            </p>
          </Card>
        ) : null}
        <FormError error={localError ?? save.error} />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={save.busy || uploading > 0}>
            {save.busy ? 'Saving…' : editing ? 'Save changes' : 'Save room'}
          </Button>
        </div>
      </div>
    </form>
  );
}
