import type { ComponentType, ReactNode } from 'react';
import { Text, View } from 'react-native';
import { AlertTriangle, CheckCircle2, WifiOff } from 'lucide-react-native';
import { Button } from './Button';
import { ApiError, errorMessage } from '@/api/errors';
import { colors } from '@/theme/colors';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n';

type IconT = ComponentType<{ size?: number; color?: string }>;

interface EmptyStateProps {
  title: string;
  /** Always say what to do next. */
  body: string;
  icon?: IconT;
  action?: { label: string; onPress: () => void };
  className?: string;
}

export function EmptyState({ title, body, icon: Icon = CheckCircle2, action, className }: EmptyStateProps) {
  return (
    <View className={cn('items-center rounded-2xl border border-slate-200 bg-white p-8', className)}>
      <Icon size={32} color={colors.ok} />
      <Text className="mt-2 text-center text-sm font-bold text-slate-800">{title}</Text>
      <Text className="mt-1 text-center text-xs text-slate-500">{body}</Text>
      {action ? <Button className="mt-4" size="sm" label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

/** Full-block error with a next step. Network failures get the offline wording. */
export function ErrorState({ error, onRetry, className }: ErrorStateProps) {
  const t = useT();
  const offline = error instanceof ApiError && error.isNetwork;
  const Icon = offline ? WifiOff : AlertTriangle;
  return (
    <View className={cn('items-center rounded-2xl border border-slate-200 bg-white p-8', className)}>
      <Icon size={30} color={offline ? colors.warn : colors.danger} />
      <Text className="mt-2 text-center text-sm font-bold text-slate-800">
        {offline ? t('errors.offlineTitle') : t('errors.genericTitle')}
      </Text>
      <Text className="mt-1 text-center text-xs text-slate-500">
        {offline ? t('errors.offlineBody') : errorMessage(error)}
      </Text>
      {onRetry ? <Button className="mt-4" size="sm" variant="outline" label={t('common.retry')} onPress={onRetry} /> : null}
    </View>
  );
}

/** Inline form-level banner (non-field API errors). Never use Alert. */
export function InlineBanner({ tone = 'error', children, testID }: { tone?: 'error' | 'warn' | 'info' | 'ok'; children: ReactNode; testID?: string }) {
  const box = {
    error: 'bg-rose-50 border-rose-200',
    warn: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200',
    ok: 'bg-emerald-50 border-emerald-200',
  }[tone];
  const text = { error: 'text-rose-800', warn: 'text-amber-900', info: 'text-blue-900', ok: 'text-emerald-900' }[tone];
  return (
    <View testID={testID} accessibilityLiveRegion="polite" className={cn('rounded-xl border p-3', box)}>
      {typeof children === 'string' ? <Text className={cn('text-xs font-semibold', text)}>{children}</Text> : children}
    </View>
  );
}
