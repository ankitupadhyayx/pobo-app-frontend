import { useEffect } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { useActions, type SuccessMessage } from '@/state/actions';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

/** The success sheet body. Exported so screens/tests can render it directly. */
export function SuccessSheet({ msg, onDone }: { msg: SuccessMessage; onDone: () => void }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDone} statusBarTranslucent>
      <View className="flex-1 justify-end bg-slate-950/60">
        <Pressable accessibilityLabel={t('common.close')} className="absolute inset-0" onPress={onDone} />
        <View testID="success-sheet" accessibilityLiveRegion="polite" className="rounded-t-3xl bg-white px-5 pt-6" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          <View className="items-center gap-2">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-teal-50">
              <CheckCircle2 size={32} color={colors.brand} />
            </View>
            <Text testID="success-title" className="text-center text-lg font-extrabold text-slate-900">
              {msg.title}
            </Text>
            {msg.body ? <Text className="text-center text-sm text-slate-600">{msg.body}</Text> : null}
          </View>
          {msg.lines?.length ? (
            <View className="mt-4 gap-2 rounded-2xl bg-slate-50 p-4">
              {msg.lines.map((l, i) => (
                <View key={i} className="flex-row gap-3">
                  {l.label ? <Text className="w-20 text-xs font-bold text-slate-500">{l.label}</Text> : null}
                  <Text className="flex-1 text-sm font-semibold text-slate-900">{l.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <View className="mt-5 flex-row gap-2">
            {(msg.actions ?? []).map((a) => (
              <Button
                key={a.label}
                testID={a.testID}
                className="flex-1"
                variant="outline"
                label={a.label}
                onPress={() => {
                  onDone();
                  a.onPress();
                }}
              />
            ))}
            <Button testID="success-done" className="flex-1" label={t('common.done')} onPress={onDone} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * The one shared completion-feedback component (REVISION1 ground rule). Mounted once in the app
 * layout. `showError(msg)` shows the same toast in the error tone (R2-8). `showToast(msg)` / `showSuccess({ title })` show a toast that hides after 2.5 s;
 * `showSuccess({ title, lines, actions })` shows a sheet that stays until Done.
 */
export function SuccessHost() {
  const toast = useActions((s) => s.toast);
  const tone = useActions((s) => s.toastTone);
  const clear = useActions((s) => s.clearToast);
  const success = useActions((s) => s.success);
  const clearSuccess = useActions((s) => s.clearSuccess);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(clear, tone === 'error' ? 4000 : 2500);
    return () => clearTimeout(h);
  }, [toast, tone, clear]);
  return (
    <>
      {success ? <SuccessSheet msg={success} onDone={clearSuccess} /> : null}
      {toast ? (
        <View pointerEvents="none" className="absolute left-4 right-4 items-center" style={{ bottom: insets.bottom + 76 }}>
          <View testID={tone === 'error' ? 'toast-error' : 'toast'} accessibilityLiveRegion="polite" className={tone === 'error' ? 'flex-row items-center gap-2 rounded-2xl bg-rose-700 px-4 py-3' : 'flex-row items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3'}>
            {tone === 'error' ? <AlertCircle size={16} color={colors.white} /> : <CheckCircle2 size={16} color={colors.white} />}
            <Text className="text-sm font-semibold text-white">{toast}</Text>
          </View>
        </View>
      ) : null}
    </>
  );
}
