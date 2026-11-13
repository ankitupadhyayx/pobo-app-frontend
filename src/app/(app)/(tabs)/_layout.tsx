import { Tabs } from 'expo-router';
import { Home, Users, MapPin, CalendarDays, IndianRupee } from 'lucide-react-native';
import { ConnectedHeader } from '@/components/shell/ConnectedHeader';
import { useHome } from '@/api/hooks/leads';
import { useLabels } from '@/api/hooks/config';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

export default function TabsLayout() {
  const t = useT();
  const L = useLabels();
  const home = useHome();
  const overdue = home.data?.items.filter((i) => i.is_overdue).length ?? 0;
  const visits = home.data?.counters.visits_today ?? 0;
  const label = (code: string, key: string) => L.glossary(code, t(key)).label;
  return (
    <Tabs
      screenOptions={{
        header: () => <ConnectedHeader />,
        tabBarActiveTintColor: colors.brandDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: { borderTopColor: colors.line, height: 62, paddingTop: 6 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: ({ color }) => <Home size={22} color={color} />, tabBarButtonTestID: 'tab-home' }} />
      <Tabs.Screen
        name="leads"
        options={{
          title: t('tabs.leads'),
          tabBarIcon: ({ color }) => <Users size={22} color={color} />,
          tabBarBadge: overdue > 0 ? overdue : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 10 },
          tabBarButtonTestID: 'tab-leads',
        }}
      />
      <Tabs.Screen name="survey" options={{ title: label('SURVEY', 'tabs.survey'), tabBarIcon: ({ color }) => <MapPin size={22} color={color} /> }} />
      <Tabs.Screen
        name="visits"
        options={{
          title: label('VISITS', 'tabs.visits'),
          tabBarIcon: ({ color }) => <CalendarDays size={22} color={color} />,
          tabBarBadge: visits > 0 ? visits : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.brand, fontSize: 10 },
        }}
      />
      <Tabs.Screen name="earnings" options={{ title: label('EARNINGS', 'tabs.earnings'), tabBarIcon: ({ color }) => <IndianRupee size={22} color={color} /> }} />
    </Tabs>
  );
}
