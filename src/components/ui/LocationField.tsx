import { Linking, Pressable, Text, View } from 'react-native';
import { CheckCircle2, MapPin, Navigation } from 'lucide-react-native';
import { TextField } from './TextField';
import { formatCoords, mapsSearchUrl, parseLocation, type LocationValue } from '@/lib/location';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

interface Props {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  label?: string;
  required?: boolean;
  /** Used for "Open Google Maps" when no address is typed yet (e.g. the sector or society). */
  areaHint?: string;
  error?: string;
  testID?: string;
}

/**
 * RV2-A: full text address (enough on its own) + "Open Google Maps" + "Paste location" (a Maps
 * link or "lat, lon") with a parsed preview. No Google API key needed.
 */
export function LocationField({ value, onChange, label, required, areaHint, error, testID = 'location' }: Props) {
  const t = useT();
  const parsed = parseLocation(value.paste);
  const pasteBad = !!value.paste.trim() && !parsed;
  const open = () => void Linking.openURL(mapsSearchUrl(value.addressText.trim() || areaHint || '')).catch(() => undefined);

  return (
    <View className="gap-2">
      <TextField
        testID={`${testID}-address`}
        label={label ?? t('location.address')}
        required={required}
        multiline
        placeholder={t('location.addressPlaceholder')}
        value={value.addressText}
        onChangeText={(addressText) => onChange({ ...value, addressText })}
        error={error}
        hint={t('location.addressHint')}
      />
      <Pressable
        testID={`${testID}-open-maps`}
        accessibilityRole="button"
        onPress={open}
        className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 active:bg-teal-100"
      >
        <Navigation size={16} color={colors.brandDark} />
        <Text className="text-sm font-bold text-teal-800">{t('location.openMaps')}</Text>
      </Pressable>
      <TextField
        testID={`${testID}-paste`}
        label={t('location.paste')}
        placeholder={t('location.pastePlaceholder')}
        autoCapitalize="none"
        autoCorrect={false}
        value={value.paste}
        onChangeText={(paste) => onChange({ ...value, paste })}
        error={pasteBad ? t('location.pasteInvalid') : undefined}
        hint={parsed ? undefined : t('location.pasteHint')}
      />
      {parsed ? (
        <View testID={`${testID}-preview`} className="flex-row items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2">
          {parsed.latitude != null && parsed.longitude != null ? (
            <>
              <CheckCircle2 size={14} color={colors.ok} />
              <Text className="text-xs font-bold text-emerald-800">{`${formatCoords(parsed.latitude, parsed.longitude)} ✓`}</Text>
            </>
          ) : (
            <>
              <MapPin size={14} color={colors.muted} />
              <Text className="flex-1 text-xs font-semibold text-slate-700">{t('location.linkSaved')}</Text>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}
