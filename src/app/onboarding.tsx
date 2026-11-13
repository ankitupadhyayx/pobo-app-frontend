import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, ArrowRight, Building2, Check, CheckCircle2, Lock, ShieldCheck } from 'lucide-react-native';
import { Button, InlineBanner } from '@/components/ui';
import { useOnboardingAck } from '@/api/hooks/me';
import { errorMessage } from '@/api/errors';
import { analytics } from '@/lib/analytics';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';

const TOTAL = 4;

function Point({ text, tone = 'ok' }: { text: string; tone?: 'ok' | 'no' | 'lock' }) {
  const Icon = tone === 'no' ? AlertTriangle : tone === 'lock' ? Lock : CheckCircle2;
  const color = tone === 'no' ? colors.danger : tone === 'lock' ? colors.warn : colors.ok;
  return (
    <View className="flex-row items-start gap-2.5 rounded-2xl bg-white/5 p-3">
      <Icon size={18} color={color} />
      <Text className="flex-1 text-sm leading-5 text-slate-200">{text}</Text>
    </View>
  );
}

export default function OnboardingScreen() {
  const t = useT();
  const [step, setStep] = useState(1);
  const [acked, setAcked] = useState(false);
  const [ackError, setAckError] = useState(false);
  const ack = useOnboardingAck();

  const finish = async () => {
    if (!acked) {
      setAckError(true);
      return;
    }
    try {
      await ack.mutateAsync();
      analytics.track('conduct_acknowledged');
      analytics.track('onboarding_completed');
    } catch {
      // inline banner
    }
  };

  const list = (key: string) => t(key, { returnObjects: true }) as string[];

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <View className="flex-row items-center justify-between px-5 py-3">
        <Text className="text-[11px] font-bold uppercase tracking-wider text-teal-400">
          {t('onboarding.stepOf', { step, total: TOTAL })}
        </Text>
        <View className="flex-row gap-1.5">
          {Array.from({ length: TOTAL }, (_, i) => (
            <View key={i} className={cn('h-1.5 rounded-full', step === i + 1 ? 'w-6 bg-teal-400' : 'w-2 bg-slate-700')} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-6 gap-3">
        {step === 1 ? (
          <>
            <Building2 size={36} color={colors.brand} />
            <Text className="text-2xl font-extrabold text-white">{t('onboarding.s1Title')}</Text>
            <Text className="text-sm leading-5 text-slate-300">{t('onboarding.s1Body')}</Text>
            {list('onboarding.s1Points').map((p) => (
              <Point key={p} text={p} />
            ))}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text className="text-2xl font-extrabold text-white">{t('onboarding.s2Title')}</Text>
            <Text className="text-sm text-slate-300">{t('onboarding.s2Body')}</Text>
            {(t('onboarding.s2Steps', { returnObjects: true }) as [string, string][]).map(([title, desc], i) => (
              <View key={title} className="flex-row items-start gap-3 rounded-2xl bg-white/5 p-3">
                <View className="h-7 w-7 items-center justify-center rounded-full bg-teal-600">
                  <Text className="text-xs font-extrabold text-white">{i + 1}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-white">{title}</Text>
                  <Text className="mt-0.5 text-xs leading-4 text-slate-300">{desc}</Text>
                </View>
              </View>
            ))}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <ShieldCheck size={36} color={colors.brand} />
            <Text className="text-2xl font-extrabold text-white">{t('onboarding.s3Title')}</Text>
            <Text className="text-sm text-slate-300">{t('onboarding.s3Body')}</Text>
            {list('onboarding.s3Points').map((p) => (
              <Point key={p} text={p} tone="lock" />
            ))}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <Text className="text-2xl font-extrabold text-white">{t('onboarding.s4Title')}</Text>
            <Text className="text-sm text-slate-300">{t('onboarding.s4Body')}</Text>
            {list('onboarding.s4Points').map((p, i) => (
              <Point key={p} text={p} tone={i === 0 ? 'ok' : 'no'} />
            ))}
            <Pressable
              testID="onboarding-ack"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acked }}
              onPress={() => {
                setAcked(!acked);
                setAckError(false);
              }}
              className={cn(
                'mt-2 flex-row items-start gap-3 rounded-2xl border p-4',
                ackError ? 'border-rose-400 bg-rose-950/40' : acked ? 'border-teal-500 bg-teal-950/60' : 'border-slate-700 bg-white/5',
              )}
            >
              <View className={cn('mt-0.5 h-5 w-5 items-center justify-center rounded border', acked ? 'border-teal-400 bg-teal-500' : 'border-slate-500')}>
                {acked ? <Check size={14} color={colors.white} strokeWidth={3} /> : null}
              </View>
              <Text className="flex-1 text-sm leading-5 text-slate-100">{t('onboarding.ack')}</Text>
            </Pressable>
            {ackError ? <Text className="text-xs font-semibold text-rose-400">{t('onboarding.ackRequired')}</Text> : null}
            {ack.error ? <InlineBanner>{errorMessage(ack.error)}</InlineBanner> : null}
          </>
        ) : null}
      </ScrollView>

      <View className="flex-row items-center justify-between gap-3 border-t border-slate-800 px-5 py-4">
        {step > 1 ? (
          <Button variant="ghost" label={`← ${t('common.back')}`} onPress={() => setStep(step - 1)} />
        ) : (
          <View />
        )}
        {step < TOTAL ? (
          <Button label={t('common.next')} icon={ArrowRight} iconRight onPress={() => setStep(step + 1)} />
        ) : (
          <Button testID="onboarding-finish" label={t('onboarding.enter')} icon={ArrowRight} iconRight loading={ack.isPending} onPress={finish} />
        )}
      </View>
    </SafeAreaView>
  );
}
