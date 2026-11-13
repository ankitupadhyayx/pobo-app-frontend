import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import { formatINR, formatRupees, groupIndian, moneyDigits } from '@/lib/money';
import { MoneyField } from '@/components/ui';

describe('R3-1 money formatting', () => {
  afterEach(() => void i18n.changeLanguage('en'));

  it('groups digits the Indian way', () => {
    expect(groupIndian('500')).toBe('500');
    expect(groupIndian('5000')).toBe('5,000');
    expect(groupIndian('500000')).toBe('5,00,000');
    expect(groupIndian('50000000')).toBe('5,00,00,000');
    expect(groupIndian('123456789')).toBe('12,34,56,789');
    expect(moneyDigits('₹5,00,000')).toBe('500000');
    expect(formatRupees(50000000)).toBe('₹5,00,00,000');
    expect(formatRupees('12345.5')).toBe('₹12,345.50');
  });

  it('words lakhs and crores, exact below a lakh', () => {
    expect(formatINR(50000000)).toBe('₹5 Crore');
    expect(formatINR(12500000)).toBe('₹1.25 Crore');
    expect(formatINR(5000000)).toBe('₹50 Lakh');
    expect(formatINR(9850000)).toBe('₹98.5 Lakh');
    expect(formatINR(45000)).toBe('₹45,000');
    expect(formatINR('14200000.00')).toBe('₹1.42 Crore');
    expect(formatINR(null)).toBe('');
  });

  it('uses Hindi unit words in Hindi', async () => {
    await i18n.changeLanguage('hi');
    expect(formatINR(12500000)).toBe('₹1.25 करोड़');
    expect(formatINR(5000000)).toBe('₹50 लाख');
  });

  it('MoneyField shows commas while typing and keeps the exact digits', async () => {
    const seen: string[] = [];
    function Host() {
      const [v, setV] = useState('');
      return <MoneyField testID="m" label="Budget" value={v} onChangeText={(d) => (seen.push(d), setV(d))} />;
    }
    await render(<Host />);
    await fireEvent.changeText(screen.getByTestId('m'), '50000000');
    expect(seen.at(-1)).toBe('50000000');
    expect(screen.getByDisplayValue('5,00,00,000')).toBeTruthy();
    expect(screen.getByText('₹5 Crore')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('m'), '5,00,00,0005');
    expect(seen.at(-1)).toBe('500000005');
  });
});
