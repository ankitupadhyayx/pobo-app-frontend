import type { ComponentProps } from 'react';
import { TextField } from './TextField';
import { formatINR, groupIndian, moneyDigits } from '@/lib/money';

type Props = Omit<ComponentProps<typeof TextField>, 'value' | 'onChangeText' | 'keyboardType' | 'prefix'> & {
  /** Exact amount as plain digits ("50000000"); what the form stores and sends. */
  value: string | null | undefined;
  onChangeText: (digits: string) => void;
};

/**
 * R3-1 shared money input: Indian commas while typing (₹ 5,00,00,000), the worded amount below
 * (₹5 Crore · ₹1.25 Crore · ₹50 Lakh), and the exact digits kept in the form value.
 */
export function MoneyField({ value, onChangeText, hint, ...rest }: Props) {
  const digits = moneyDigits(String(value ?? '').split('.')[0]);
  const worded = digits && Number(digits) >= 100000 ? formatINR(Number(digits)) : '';
  return (
    <TextField
      {...rest}
      keyboardType="number-pad"
      prefix="₹"
      value={groupIndian(digits)}
      onChangeText={(v) => onChangeText(moneyDigits(v))}
      hint={[worded, hint].filter(Boolean).join(' · ') || undefined}
    />
  );
}
