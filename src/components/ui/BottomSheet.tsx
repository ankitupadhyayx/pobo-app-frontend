import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, X } from 'lucide-react-native';
import { FormScrollView, type FormFocus } from '@/hooks/useFormFocus';
import { colors } from '@/theme/colors';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Sticky action row (primary button within thumb reach). */
  footer?: ReactNode;
  /** Prevent dismiss while a mutation is in flight. */
  dismissable?: boolean;
  testID?: string;
  /** R2-8: scroll-to-first-invalid-field + pinned "fix N fields" notice (see useFormFocus). */
  form?: FormFocus;
}

/** Slide-up sheet used for every action flow (call outcome, follow-up, transfer, filters…). */
export function BottomSheet({ visible, onClose, title, subtitle, children, footer, dismissable = true, testID, form }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const close = () => {
    if (dismissable) onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <View className="flex-1 justify-end bg-slate-950/60" testID={testID}>
          <Pressable accessibilityLabel="Close" className="absolute inset-0" onPress={close} />
          <View className="max-h-[92%] rounded-t-3xl bg-white" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
            <View className="items-center pt-2">
              <View className="h-1 w-10 rounded-full bg-slate-300" />
            </View>
            <View className="flex-row items-start justify-between border-b border-slate-100 px-5 pb-3 pt-2">
              <View className="flex-1 pr-3">
                <Text className="text-base font-extrabold text-slate-900">{title}</Text>
                {subtitle ? <Text className="mt-0.5 text-xs text-slate-500">{subtitle}</Text> : null}
              </View>
              {dismissable ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={close} className="rounded-full p-1">
                  <X size={20} color={colors.slate400} />
                </Pressable>
              ) : null}
            </View>
            {form?.notice ? (
              <View testID="form-notice" accessibilityLiveRegion="assertive" className="flex-row items-center gap-2 border-b border-rose-100 bg-rose-50 px-5 py-2">
                <AlertCircle size={14} color={colors.danger} />
                <Text className="flex-1 text-xs font-bold text-rose-700">{form.notice}</Text>
              </View>
            ) : null}
            {form ? (
              <FormScrollView form={form} innerClassName="gap-4" keyboardShouldPersistTaps="handled" contentContainerClassName="px-5 py-4">
                {children}
              </FormScrollView>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-5 py-4 gap-4">
                {children}
              </ScrollView>
            )}
            {footer ? <View className="flex-row gap-2 border-t border-slate-100 px-5 pt-3">{footer}</View> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
