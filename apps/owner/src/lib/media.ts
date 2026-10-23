'use client';

import { getDownloadURL, ref, uploadBytes, uploadBytesResumable } from 'firebase/storage';
import type { MediaAsset } from '@thikano/domain';
import { firebase } from './firebase';

/**
 * Photos are compressed in the browser (≤1600 px, JPEG q0.82) with a 400 px thumbnail
 * before upload — Indian mobile networks first. Only URLs + metadata go to Firestore.
 */
async function resize(file: File, max: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', quality));
  return { blob, width, height };
}

export async function uploadPhoto(orgId: string, propertyId: string, file: File, sortOrder: number): Promise<MediaAsset> {
  if (!file.type.startsWith('image/')) throw Object.assign(new Error('not-image'), { code: 'invalid-argument' });
  const { storage } = firebase();
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const [full, thumb] = await Promise.all([resize(file, 1600, 0.82), resize(file, 400, 0.75)]);
  const base = `orgs/${orgId}/properties/${propertyId}/media`;
  const fullRef = ref(storage, `${base}/${id}.jpg`);
  const thumbRef = ref(storage, `${base}/${id}_thumb.jpg`);
  await Promise.all([uploadBytes(fullRef, full.blob, { contentType: 'image/jpeg' }), uploadBytes(thumbRef, thumb.blob, { contentType: 'image/jpeg' })]);
  const [url, thumbUrl] = await Promise.all([getDownloadURL(fullRef), getDownloadURL(thumbRef)]);
  return { id, kind: 'photo', storagePath: fullRef.fullPath, url, thumbUrl, width: full.width, height: full.height, sortOrder };
}

/** Optional walkthrough video: resumable upload with progress; never blocks saving the room. */
export function uploadVideo(orgId: string, propertyId: string, file: File, onProgress: (pct: number) => void): Promise<MediaAsset> {
  const { storage } = firebase();
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const ext = file.type === 'video/quicktime' ? 'mov' : file.type === 'video/webm' ? 'webm' : 'mp4';
  const r = ref(storage, `orgs/${orgId}/properties/${propertyId}/media/${id}.${ext}`);
  const task = uploadBytesResumable(r, file, { contentType: file.type });
  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (s) => onProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
      reject,
      async () => resolve({ id, kind: 'video', storagePath: r.fullPath, url: await getDownloadURL(r), sortOrder: 0 }),
    );
  });
}
