import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { ArrowLeft, Camera, Film, ImagePlus, RotateCcw, Star, Trash2, Video } from 'lucide-react-native';
import { Button, InlineBanner } from '@/components/ui';
import { useDeletePhoto, useUpdatePhoto, type LocalMedia } from '@/api/hooks/listings';
import { errorMessage } from '@/api/errors';
import { takePhotos, takeVideo } from '@/lib/photos';
import { useActions } from '@/state/actions';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';
import type { components } from '@/api/schema';

type Photo = components['schemas']['Photo'];

interface Props {
  listingId: string;
  photos: Photo[];
  /** Saves one item (to the listing or through the visit); `isCover` for the first photo. */
  upload: (m: LocalMedia, opts: { isCover: boolean; onProgress?: (fraction: number) => void }) => Promise<unknown>;
  canAdd: boolean;
  online: boolean;
  /** "2 of 3 photos" progress (inspection minimum). */
  minPhotos?: number;
  maxVideoBytes?: number;
  testID?: string;
}

/**
 * R2-6 property media: Add photos (camera or several from the gallery) and Add video, preview,
 * choose the cover (star), remove. Used on the property screen and inside an active
 * Inspection / Photography visit (media then saves to that visit's property).
 */
export function MediaPanel({ listingId, photos, upload, canAdd, online, minPhotos, maxVideoBytes, testID = 'media' }: Props) {
  const t = useT();
  const showToast = useActions((s) => s.showToast);
  const [ask, setAsk] = useState<null | 'PHOTO' | 'VIDEO'>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  /** R3-4: items that didn't upload, kept so "Retry" sends them again without re-picking. */
  const [failed, setFailed] = useState<LocalMedia[]>([]);
  /** R3-4: after a camera photo, offer "Take another" so several shots are easy. */
  const [again, setAgain] = useState(false);
  const del = useDeletePhoto(listingId);
  const update = useUpdatePhoto(listingId);
  const pics = photos.filter((p) => p.media_type !== 'VIDEO');
  const vids = photos.filter((p) => p.media_type === 'VIDEO');

  const send = async (items: LocalMedia[]) => {
    setErr(null);
    setFailed([]);
    let done = 0;
    let coverTaken = pics.length > 0;
    try {
      for (const [i, m] of items.entries()) {
        const label = t('media.uploading', { n: i + 1, total: items.length });
        setBusy(label);
        const isCover = m.kind === 'PHOTO' && !coverTaken;
        await upload(m, { isCover, onProgress: (f) => setBusy(`${label} ${Math.round(f * 100)}%`) });
        if (isCover) coverTaken = true;
        done++;
      }
      const vidsOnly = items.every((m) => m.kind === 'VIDEO');
      showToast(vidsOnly ? t('media.videoSaved') : t('media.photosSaved', { count: done }));
      return true;
    } catch (e) {
      setFailed(items.slice(done));
      setErr(done ? t('media.partial', { done, total: items.length, msg: errorMessage(e) }) : errorMessage(e));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const add = async (kind: 'PHOTO' | 'VIDEO', source: 'camera' | 'library') => {
    setAsk(null);
    setErr(null);
    setAgain(false);
    let items: LocalMedia[] = [];
    if (kind === 'PHOTO') {
      const r = await takePhotos(source);
      if (typeof r === 'string') return r === 'cancelled' ? undefined : setErr(t(`photos.${r}`));
      items = r.map((p) => ({ uri: p.uri, mime: p.mime, kind: 'PHOTO' as const }));
    } else {
      const r = await takeVideo(source, maxVideoBytes);
      if (typeof r === 'string') return r === 'cancelled' ? undefined : setErr(r === 'too_large' ? t('media.tooLarge', { mb: Math.round((maxVideoBytes ?? 0) / 1e6) }) : t(`photos.${r}`));
      items = [{ uri: r.uri, mime: r.mime, kind: 'VIDEO' }];
    }
    const ok = await send(items);
    if (ok && kind === 'PHOTO' && source === 'camera') setAgain(true);
  };

  /** Move a photo one place earlier (sort_order); the server reorders the rest. */
  const moveEarlier = (id: string, index: number) =>
    update.mutate({ photoId: id, body: { sort_order: Math.max(0, index - 1) } }, { onSuccess: () => showToast(t('media.moved')), onError: (e) => setErr(errorMessage(e)) });

  const pending = minPhotos ? Math.max(0, minPhotos - pics.length) : 0;
  return (
    <View testID={testID} className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{t('media.title', { photos: pics.length, videos: vids.length })}</Text>
        {minPhotos ? (
          <Text testID={`${testID}-progress`} className={cn('text-[11px] font-bold', pending ? 'text-amber-700' : 'text-emerald-700')}>
            {pending ? t('media.morePhotos', { count: pending }) : t('media.enoughPhotos')}
          </Text>
        ) : null}
      </View>
      {photos.length ? (
        <View className="flex-row flex-wrap gap-2">
          {photos.map((p, index) => (
            <View key={p.id} className="relative">
              {p.media_type === 'VIDEO' ? (
                <View className="h-24 w-24 items-center justify-center rounded-xl bg-slate-800">
                  {p.thumbnail_url ? <Image source={{ uri: p.thumbnail_url }} className="absolute inset-0 rounded-xl" /> : null}
                  <Film size={22} color={colors.white} />
                </View>
              ) : (
                <Image source={{ uri: p.thumbnail_url || p.url }} className="h-24 w-24 rounded-xl bg-slate-200" accessibilityLabel={p.caption || t('media.photo')} />
              )}
              {p.media_type !== 'VIDEO' ? (
                <Pressable
                  testID={`${testID}-cover-${p.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={p.is_cover ? t('media.isCover') : t('media.makeCover')}
                  disabled={!canAdd || p.is_cover || update.isPending}
                  hitSlop={6}
                  onPress={() => update.mutate({ photoId: p.id, body: { is_cover: true } }, { onSuccess: () => showToast(t('media.coverSet')), onError: (e) => setErr(errorMessage(e)) })}
                  className={cn('absolute left-1 top-1 rounded-full p-1', p.is_cover ? 'bg-amber-400' : 'bg-white/90')}
                >
                  <Star size={11} color={p.is_cover ? '#78350f' : colors.muted} />
                </Pressable>
              ) : null}
              {canAdd && index > 0 ? (
                <Pressable
                  testID={`${testID}-earlier-${p.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('media.moveEarlier')}
                  disabled={update.isPending}
                  hitSlop={6}
                  onPress={() => moveEarlier(p.id, index)}
                  className="absolute bottom-1 left-1 rounded-full bg-white/90 p-1"
                >
                  <ArrowLeft size={12} color={colors.muted} />
                </Pressable>
              ) : null}
              {canAdd ? (
                <Pressable testID={`${testID}-remove-${p.id}`} accessibilityRole="button" accessibilityLabel={t('media.remove')} hitSlop={8} onPress={() => del.mutate(p.id)} className="absolute right-1 top-1 rounded-full bg-white/90 p-1">
                  <Trash2 size={12} color={colors.danger} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <Text className="text-xs text-slate-500">{t('media.empty')}</Text>
      )}
      {pics.length > 1 ? <Text className="text-[11px] text-slate-500">{t('media.coverHint')}</Text> : null}
      {canAdd ? (
        <>
          <View className="flex-row gap-2">
            <Button testID={`${testID}-add-photos`} className="flex-1" size="sm" variant="secondary" icon={ImagePlus} label={t('media.addPhotos')} disabled={!online || !!busy} onPress={() => setAsk(ask === 'PHOTO' ? null : 'PHOTO')} />
            <Button testID={`${testID}-add-video`} className="flex-1" size="sm" variant="secondary" icon={Video} label={t('media.addVideo')} disabled={!online || !!busy} onPress={() => setAsk(ask === 'VIDEO' ? null : 'VIDEO')} />
          </View>
          {ask ? (
            <View className="flex-row gap-2">
              <Button testID={`${testID}-camera`} className="flex-1" size="sm" icon={Camera} label={ask === 'VIDEO' ? t('media.recordVideo') : t('photos.camera')} onPress={() => void add(ask, 'camera')} />
              <Button testID={`${testID}-gallery`} className="flex-1" size="sm" icon={ImagePlus} label={t('photos.gallery')} onPress={() => void add(ask, 'library')} />
            </View>
          ) : null}
          {again && !busy && !ask ? (
            <Button testID={`${testID}-take-another`} size="sm" variant="secondary" icon={Camera} label={t('media.takeAnother')} disabled={!online} onPress={() => void add('PHOTO', 'camera')} />
          ) : null}
          {busy ? <Text testID={`${testID}-busy`} className="text-[11px] font-semibold text-teal-700">{busy}</Text> : null}
          {failed.length && !busy ? (
            <Button testID={`${testID}-retry`} size="sm" variant="secondary" icon={RotateCcw} label={t('media.retry', { count: failed.length })} disabled={!online} onPress={() => void send(failed)} />
          ) : null}
          {!online ? <Text className="text-[11px] text-slate-500">{t('photos.needOnline')}</Text> : null}
        </>
      ) : null}
      {err ? <InlineBanner testID={`${testID}-error`}>{err}</InlineBanner> : null}
    </View>
  );
}
