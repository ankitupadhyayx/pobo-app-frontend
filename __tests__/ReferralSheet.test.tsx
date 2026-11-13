import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import '@/i18n';
import { ReferralSheet } from '@/components/sheets/ReferralSheet';
import type { Referral } from '@/api/types';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

const opts = (codes: string[]) => codes.map((c) => ({ value: c, label: c }));
const baseProps = {
  visible: true,
  onClose: jest.fn(),
  types: opts(['BUY', 'SELL']),
  configurations: opts(['3BHK', 'VILLA']),
  relations: opts(['FRIEND', 'FAMILY']),
  callbacks: opts(['MORNING', 'EVENING']),
  typeLabel: (t: string) => t,
};

const referral: Referral = {
  id: 'r1',
  referred_name: 'Ramesh Chandra',
  referred_phone_masked: '98123 •••••',
  status: 'CREATED',
  notes: '',
  referrer_relation: 'FRIEND',
  duplicate_review_id: null,
  created_at: '2026-10-23T06:00:00Z',
  requirements: [
    {
      id: 'q1',
      type: 'BUY',
      status: 'NEW',
      assignment_state: 'ASSIGNED',
      servicing_aa_name: 'Anita Verma',
      assignment_reason: 'Primary AA for territory Sector 150',
    },
  ],
};

describe('<ReferralSheet />', () => {
  it('requires location, sends the prototype fields, then shows who will service it', async () => {
    const onSubmit = jest.fn(async () => referral);
    await render(<ReferralSheet {...baseProps} onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByTestId('referral-name'), 'Ramesh Chandra');
    await fireEvent.changeText(screen.getByTestId('referral-phone'), '9812300000');
    await fireEvent.press(screen.getByTestId('referral-type-BUY'));
    await fireEvent.press(screen.getByTestId('referral-consent'));
    await fireEvent.press(screen.getByTestId('referral-submit'));
    expect(onSubmit).not.toHaveBeenCalled(); // location is required

    await fireEvent.changeText(screen.getByTestId('referral-location'), 'Sector 150');
    await fireEvent.press(screen.getByTestId('referral-config-VILLA'));
    await fireEvent.press(screen.getByTestId('referral-relation-FRIEND'));
    await fireEvent.press(screen.getByTestId('referral-callback-EVENING'));
    await fireEvent.press(screen.getByTestId('referral-submit'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ location: 'Sector 150', configuration: 'VILLA', relation: 'FRIEND', callback: 'EVENING', types: ['BUY'] }),
    );
    await waitFor(() => expect(screen.getByTestId('assignment-result')).toBeTruthy());
    expect(screen.getByText('Assigned to Anita Verma')).toBeTruthy();
    expect(screen.getByText('Primary AA for territory Sector 150')).toBeTruthy();
  });
});
