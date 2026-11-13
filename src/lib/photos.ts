import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * APP-25 photo capture. Camera or gallery → resized so the long edge is ≤ 1600 px, JPEG ~0.7
 * (PHASE2: compress before upload). Upload is presigned (POST /uploads/presign → PUT to storage →
 * attach the returned key) and lives in src/api/hooks/uploads.ts.
 */
export const MAX_EDGE = 1600;

export interface LocalPhoto {
  uri: string;
  width: number;
  height: number;
  mime: 'image/jpeg';
}

export type PhotoError = 'permission_denied' | 'cancelled' | 'failed';

/** Target size keeping aspect ratio; never upscales. */
export function fitWithin(w: number, h: number, max = MAX_EDGE): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  return w >= h ? { width: max, height: Math.round((h / w) * max) } : { width: Math.round((w / h) * max), height: max };
}

export async function compress(uri: string, width: number, height: number): Promise<LocalPhoto> {
  const target = fitWithin(width, height);
  const ctx = ImageManipulator.manipulate(uri);
  if (target.width !== width) ctx.resize({ width: target.width, height: target.height });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return { uri: out.uri, width: out.width, height: out.height, mime: 'image/jpeg' };
}

export async function takePhoto(source: 'camera' | 'library'): Promise<LocalPhoto | PhotoError> {
  try {
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return 'permission_denied';
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets[0]) return 'cancelled';
    const a = res.assets[0];
    return await compress(a.uri, a.width, a.height);
  } catch {
    return 'failed';
  }
}

/** R2-6: several photos at once from the gallery (camera gives one), each compressed. */
export async function takePhotos(source: 'camera' | 'library', max = 10): Promise<LocalPhoto[] | PhotoError> {
  if (source === 'camera') {
    const one = await takePhoto('camera');
    return typeof one === 'string' ? one : [one];
  }
  try {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return 'permission_denied';
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false, allowsMultipleSelection: true, selectionLimit: max });
    if (res.canceled || !res.assets.length) return 'cancelled';
    const out: LocalPhoto[] = [];
    for (const a of res.assets) out.push(await compress(a.uri, a.width, a.height));
    return out;
  } catch {
    return 'failed';
  }
}

export interface LocalVideo {
  uri: string;
  mime: string;
  sizeBytes: number | null;
  durationMs: number | null;
}

export type VideoError = PhotoError | 'too_large';

/** R2-6: one video from the camera or gallery (no re-encode; the server enforces the size limit). */
export async function takeVideo(source: 'camera' | 'library', maxBytes?: number): Promise<LocalVideo | VideoError> {
  try {
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return 'permission_denied';
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['videos'], videoMaxDuration: 120, quality: 1 };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets[0]) return 'cancelled';
    const a = res.assets[0];
    const size = a.fileSize ?? null;
    if (maxBytes && size && size > maxBytes) return 'too_large';
    return { uri: a.uri, mime: a.mimeType || 'video/mp4', sizeBytes: size, durationMs: a.duration ?? null };
  } catch {
    return 'failed';
  }
}
