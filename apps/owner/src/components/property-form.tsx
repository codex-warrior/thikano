'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ImagePlus, Loader2, LocateFixed, Trash2 } from 'lucide-react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { PROPERTY_AMENITY_LABEL, type MediaAsset, type Property, type PropertyAmenity } from '@thikano/domain';
import { Button, Card } from '@thikano/web-ui';
import { uploadPhoto } from '@/lib/media';
import { newId, useMutation } from '@/lib/use-mutation';
import { selectProperty } from '@/app/(console)/actions';
import { CheckGroup, Field, FormError, Select, TextArea } from './form';

export function PropertyForm({ orgId, uid, property }: { orgId: string; uid: string; property?: Property | null }) {
  const router = useRouter();
  const editing = !!property;
  const [propertyId] = useState(() => property?.id ?? newId('prop'));
  const [photos, setPhotos] = useState<MediaAsset[]>(property?.photos ?? []);
  const [uploading, setUploading] = useState(0);
  const [loc, setLoc] = useState<{ lat: string; lng: string }>({ lat: property ? String(property.location.lat) : '', lng: property ? String(property.location.lng) : '' });
  const [localError, setLocalError] = useState<string | null>(null);

  const save = useMutation(async (fb, f: FormData) => {
    const t = Date.now();
    const fields = {
      name: String(f.get('name')).trim(),
      kind: f.get('kind') as Property['kind'],
      genderRule: f.get('genderRule') as Property['genderRule'],
      description: String(f.get('description') ?? '').trim(),
      address: {
        line1: String(f.get('line1')).trim(),
        line2: String(f.get('line2') ?? '').trim(),
        locality: String(f.get('locality')).trim(),
        city: String(f.get('city')).trim(),
        state: String(f.get('state')).trim(),
        pincode: String(f.get('pincode')).trim(),
      },
      location: { lat: Number(loc.lat), lng: Number(loc.lng) },
      nearbyColleges: String(f.get('colleges') ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10),
      amenities: f.getAll('amenities').map(String) as PropertyAmenity[],
      rules: String(f.get('rules') ?? '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 20),
      foodIncluded: f.get('foodIncluded') === 'on',
      photos: photos.map((p, i) => ({ ...p, sortOrder: i })),
      publicContactPhone: String(f.get('publicContactPhone') ?? '').trim() || null,
      updatedAt: t,
    };
    const ref = doc(fb.db, `organizations/${orgId}/properties/${propertyId}`);
    if (editing) await updateDoc(ref, fields);
    else await setDoc(ref, { id: propertyId, orgId, ...fields, videos: [], verification: 'draft', createdAt: t, createdBy: uid });
    return propertyId;
  });

  async function onPhotos(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files].slice(0, 10 - photos.length);
    setUploading((n) => n + list.length);
    for (const file of list) {
      try {
        const a = await uploadPhoto(orgId, propertyId, file, photos.length);
        setPhotos((p) => [...p, a]);
      } catch {
        setLocalError("One photo couldn't be uploaded. Please try again.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  return (
    <form
      className="grid gap-6 lg:grid-cols-[1.4fr_1fr]"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setLocalError(null);
        if (!Number.isFinite(Number(loc.lat)) || !Number.isFinite(Number(loc.lng)) || !loc.lat || !loc.lng) return setLocalError('Please set the property location (use “Use my location” while at the PG, or enter coordinates).');
        if (!/^\d{6}$/.test(String(f.get('pincode')))) return setLocalError('Please enter a 6-digit pincode.');
        const id = await save.run(f);
        if (!id) return;
        if (!editing) {
          await selectProperty(id);
          router.push('/rooms/new');
        }
        router.refresh();
      }}
    >
      <div className="space-y-6">
        <Card className="space-y-4 p-5">
          <Field label="Property name" name="name" defaultValue={property?.name} placeholder="Sunrise PG" required minLength={2} maxLength={60} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Type" name="kind" defaultValue={property?.kind ?? 'pg'}>
              <option value="pg">PG</option>
              <option value="hostel">Hostel</option>
              <option value="student_housing">Student housing</option>
            </Select>
            <Select label="For" name="genderRule" defaultValue={property?.genderRule ?? 'boys'}>
              <option value="boys">Boys</option>
              <option value="girls">Girls</option>
              <option value="coed">Co-living</option>
            </Select>
          </div>
          <TextArea label="About the property" name="description" rows={3} defaultValue={property?.description} placeholder="Home-style meals, daily housekeeping, 5 minutes from the college gate." maxLength={800} />
          <label className="flex items-center gap-2 text-[13.5px] font-medium text-ink-700">
            <input type="checkbox" name="foodIncluded" defaultChecked={property?.foodIncluded ?? true} className="size-4 accent-navy-700" /> Food included in rent
          </label>
        </Card>
        <Card className="space-y-4 p-5">
          <p className="text-[14px] font-bold">Address</p>
          <Field label="Address line" name="line1" defaultValue={property?.address.line1} placeholder="Plot 12, Kukas Main Road" required />
          <Field label="Landmark (optional)" name="line2" defaultValue={property?.address.line2} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Area / locality" name="locality" defaultValue={property?.address.locality} placeholder="Kukas" required />
            <Field label="City" name="city" defaultValue={property?.address.city ?? 'Jaipur'} required />
            <Field label="State" name="state" defaultValue={property?.address.state ?? 'Rajasthan'} required />
            <Field label="Pincode" name="pincode" defaultValue={property?.address.pincode} inputMode="numeric" required />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-ink-700">Location</p>
            <p className="text-[12px] text-ink-400">Students see an approximate area (±150 m), never your exact address.</p>
            <div className="mt-2 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <Field label="Latitude" name="lat" value={loc.lat} onChange={(e) => setLoc((l) => ({ ...l, lat: e.target.value }))} inputMode="decimal" />
              <Field label="Longitude" name="lng" value={loc.lng} onChange={(e) => setLoc((l) => ({ ...l, lng: e.target.value }))} inputMode="decimal" />
              <Button
                type="button"
                variant="secondary"
                className="mb-0.5 h-11"
                onClick={() =>
                  navigator.geolocation?.getCurrentPosition(
                    (p) => setLoc({ lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) }),
                    () => setLocalError("We couldn't get your location. Please allow location access or enter it manually."),
                    { enableHighAccuracy: true, timeout: 10_000 },
                  )
                }
              >
                <LocateFixed size={15} /> Use my location
              </Button>
            </div>
          </div>
          <Field label="Nearby colleges" name="colleges" defaultValue={property?.nearbyColleges.join(', ')} placeholder="JECRC Foundation, Arya College" hint="Comma separated — students search by college." />
        </Card>
      </div>
      <div className="space-y-6">
        <Card className="p-5">
          <CheckGroup label="Facilities" name="amenities" options={(Object.keys(PROPERTY_AMENITY_LABEL) as PropertyAmenity[]).map((a) => ({ value: a, label: PROPERTY_AMENITY_LABEL[a] }))} defaultValue={property?.amenities ?? ['food', 'wifi', 'cctv', 'power_backup']} />
        </Card>
        <Card className="p-5">
          <TextArea label="House rules (one per line)" name="rules" rows={4} defaultValue={property?.rules.join('\n') ?? 'Gate closes at 10:30 PM\nNo smoking or alcohol\nOne month notice before moving out'} />
        </Card>
        <Card className="p-5">
          <Field label="Public contact number (optional)" name="publicContactPhone" type="tel" defaultValue={property?.publicContactPhone ?? ''} hint="Only shown on your public pages if you add it here." />
        </Card>
        <Card className="p-5">
          <p className="text-[13px] font-semibold text-ink-700">Property photos</p>
          <p className="text-[12px] text-ink-400">Entrance, building, common areas, mess.</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg bg-navy-50">
                <img src={p.thumbUrl ?? p.url} alt="" className="size-full object-cover" />
                <button type="button" onClick={() => setPhotos((ps) => ps.filter((x) => x.id !== p.id))} className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-white/90 text-bad-600 opacity-0 group-hover:opacity-100" aria-label="Remove photo">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {Array.from({ length: uploading }).map((_, i) => (
              <div key={i} className="grid aspect-square place-items-center rounded-lg bg-navy-50">
                <Loader2 size={18} className="animate-spin text-navy-500" />
              </div>
            ))}
            {photos.length < 10 ? (
              <label className="grid aspect-square cursor-pointer place-items-center rounded-lg border border-dashed border-line-strong text-ink-400 hover:border-navy-500">
                <span className="flex flex-col items-center gap-1 text-[12px] font-semibold">
                  <ImagePlus size={20} /> Add
                </span>
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => onPhotos(e.target.files)} />
              </label>
            ) : null}
          </div>
        </Card>
        <FormError error={localError ?? save.error} />
        <Button type="submit" className="w-full" disabled={save.busy || uploading > 0}>
          {save.busy ? 'Saving…' : editing ? 'Save property' : 'Create property'}
        </Button>
      </div>
    </form>
  );
}
