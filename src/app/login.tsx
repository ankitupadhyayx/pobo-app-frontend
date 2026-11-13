import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, type TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, Phone, ShieldCheck } from 'lucide-react-native';
import { Button, InlineBanner, TextField } from '@/components/ui';
import { useRequestOtp, useVerifyOtp } from '@/api/hooks/auth';
import { ApiError, errorMessage } from '@/api/errors';
import { useNow } from '@/hooks/useNow';
import { useSession } from '@/state/session';
import { analytics } from '@/lib/analytics';
import { colors } from '@/theme/colors';
import i18n, { setLanguage, useT } from '@/i18n';
import { cn } from '@/lib/cn';

const PHONE_RE = /^[6-9]\d{9}$/;

function LanguageToggle() {
  const [lang, setLang] = useState(i18n.language);
  return (
    <View className="flex-row rounded-full border border-teal-700 bg-teal-900/60 p-0.5">
      {(
        [
          ['en', 'English'],
          ['hi', 'हिन्दी'],
        ] as const
      ).map(([code, label]) => (
        <Pressable
          key={code}
          accessibilityRole="button"
          accessibilityState={{ selected: lang === code }}
          onPress={() => {
            setLanguage(code);
            setLang(code);
          }}
          className={cn('rounded-full px-3 py-1', lang === code && 'bg-teal-600')}
        >
          <Text className={cn('text-xs font-bold', lang === code ? 'text-white' : 'text-teal-200')}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function LoginScreen() {
  const t = useT();
  const expired = useSession((s) => s.expired);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState<number>(0);
  const [resentNote, setResentNote] = useState(false);
  const otpRef = useRef<TextInputInstance>(null);
  const now = useNow();

  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();

  const resendLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (step === 'otp') setTimeout(() => otpRef.current?.focus(), 250);
  }, [step]);

  const sendOtp = async (isResend = false) => {
    setLocalError(null);
    if (!PHONE_RE.test(phone)) {
      setLocalError(t('errors.phone'));
      return;
    }
    if (!isResend) analytics.track('login_started');
    try {
      const res = await requestOtp.mutateAsync(phone);
      setResendAt(Date.now() + (res.resendAfterSeconds ?? 30) * 1000);
      setStep('otp');
      setResentNote(isResend);
    } catch {
      // shown inline below via requestOtp.error
    }
  };

  const submitOtp = async () => {
    setLocalError(null);
    if (!/^\d{6}$/.test(otp)) {
      setLocalError(t('auth.otpInvalid'));
      return;
    }
    try {
      await verifyOtp.mutateAsync({ phone, code: otp });
      analytics.track('login_completed');
    } catch {
      // inline
    }
  };

  const apiErr = (step === 'phone' ? requestOtp.error : verifyOtp.error ?? requestOtp.error) as ApiError | null;
  const fieldErr = apiErr?.fields?.phone ?? apiErr?.fields?.code ?? apiErr?.fields?.otp;
  const bannerErr = apiErr && !fieldErr ? errorMessage(apiErr) : null;

  return (
    <SafeAreaView className="flex-1 bg-teal-950">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="flex-grow px-5 pb-6">
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center gap-2">
              <View className="h-8 w-8 items-center justify-center rounded-lg bg-teal-600">
                <Text className="font-extrabold text-white">P</Text>
              </View>
              <Text className="text-lg font-extrabold tracking-tight text-white">POBO</Text>
            </View>
            <LanguageToggle />
          </View>

          <View className="mt-10 flex-1">
            <Text className="text-xs font-bold uppercase tracking-wider text-teal-300">{t('auth.portal')}</Text>
            <Text className="mt-1 text-3xl font-extrabold tracking-tight text-white">
              {step === 'phone' ? t('auth.welcome') : t('auth.otpTitle')}
            </Text>
            {step === 'phone' ? (
              <Text className="mt-2 text-sm text-teal-100/80">{t('auth.tagline')}</Text>
            ) : (
              <View className="mt-2 flex-row items-center gap-2">
                <Text className="text-sm text-teal-100/80">{t('auth.otpSentTo', { phone })}</Text>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => {
                    setStep('phone');
                    setOtp('');
                    verifyOtp.reset();
                  }}
                >
                  <Text className="text-sm font-bold text-teal-300 underline">{t('auth.change')}</Text>
                </Pressable>
              </View>
            )}

            <View className="mt-8 gap-4 rounded-3xl bg-white p-5">
              {expired && step === 'phone' ? <InlineBanner tone="warn">{t('auth.sessionExpired')}</InlineBanner> : null}
              {step === 'phone' ? (
                <TextField
                  testID="login-phone"
                  label={t('auth.mobileLabel')}
                  prefix="+91"
                  value={phone}
                  onChangeText={(v) => {
                    setPhone(v.replace(/\D/g, '').slice(0, 10));
                    setLocalError(null);
                    requestOtp.reset();
                  }}
                  keyboardType="number-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  maxLength={10}
                  placeholder="98765 43210"
                  returnKeyType="done"
                  onSubmitEditing={() => sendOtp()}
                  error={localError ?? fieldErr}
                />
              ) : (
                <>
                  <TextField
                    testID="login-otp"
                    ref={otpRef}
                    label="OTP"
                    value={otp}
                    onChangeText={(v) => {
                      setOtp(v.replace(/\D/g, '').slice(0, 6));
                      setLocalError(null);
                      verifyOtp.reset();
                    }}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    maxLength={6}
                    placeholder="• • • • • •"
                    onSubmitEditing={submitOtp}
                    error={localError ?? fieldErr}
                  />
                  {resentNote && !apiErr ? <InlineBanner tone="ok">{t('auth.resent')}</InlineBanner> : null}
                  <View className="items-center">
                    {resendLeft > 0 ? (
                      <Text className="text-xs font-semibold text-slate-500" style={{ fontVariant: ['tabular-nums'] }}>
                        {t('auth.resendIn', { s: resendLeft })}
                      </Text>
                    ) : (
                      <Pressable accessibilityRole="button" hitSlop={8} disabled={requestOtp.isPending} onPress={() => sendOtp(true)}>
                        <Text className="text-xs font-bold text-teal-700">{t('auth.resend')}</Text>
                      </Pressable>
                    )}
                  </View>
                </>
              )}
              {bannerErr ? <InlineBanner>{bannerErr}</InlineBanner> : null}
              <Button
                testID="login-submit"
                size="lg"
                fullWidth
                icon={step === 'phone' ? Phone : ShieldCheck}
                label={step === 'phone' ? t('auth.continue') : t('auth.verify')}
                loading={step === 'phone' ? requestOtp.isPending : verifyOtp.isPending}
                onPress={step === 'phone' ? () => sendOtp() : submitOtp}
              />
            </View>
          </View>

          <View className="mt-8 flex-row items-center justify-center gap-1">
            <ArrowRight size={10} color={colors.slate400} />
            <Text className="text-center text-[11px] text-teal-200/60">{t('auth.footer')}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
