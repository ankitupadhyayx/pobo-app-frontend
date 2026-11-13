import { fireEvent, render, screen } from '@testing-library/react-native';
import { PhoneCall } from 'lucide-react-native';
import '@/i18n';
import { ActionCard } from '@/components/home/ActionCard';

describe('<ActionCard />', () => {
  it('shows the next-action button and fires it', async () => {
    const onCall = jest.fn();
    await render(<ActionCard badge="New lead" tone="new" title="Rahul S." context="BUY · Sector 150" primary={{ label: 'Call', icon: PhoneCall, onPress: onCall }} />);
    fireEvent.press(screen.getByLabelText('Call'));
    expect(onCall).toHaveBeenCalled();
  });

  it('suppresses outbound actions for DNC customers', async () => {
    await render(
      <ActionCard badge="Follow-up" tone="due" title="X" dnc dncText="Do Not Contact" primary={{ label: 'Call', onPress: jest.fn() }} />,
    );
    expect(screen.queryByLabelText('Call')).toBeNull();
    expect(screen.getByText('Do Not Contact')).toBeTruthy();
  });
});
