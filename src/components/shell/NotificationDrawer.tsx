import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { SideDrawer } from '@/components/ui';
import { NotificationList, type NotificationItem } from './NotificationList';
import { useMarkAllRead, useMarkRead, useNotifications } from '@/api/hooks/account';
import { useActions } from '@/state/actions';
import { notificationHref } from '@/lib/deeplink';
import { isExpoGo } from '@/lib/push';
import { analytics } from '@/lib/analytics';
import { useT } from '@/i18n';
import { notificationIcon } from './notificationIcons';

const URGENT = new Set(['SLA_BREACH', 'SLA_WARNING', 'ESCALATION', 'FLOAT_OFFER']);
const KEY_ACTIONS = new Set(['KEY_COLLECTED', 'KEY_RETURNED', 'KEY_RETURN_REQUESTED']);

/** APP-19 in-app notification drawer; tapping deep-links to the lead. */
export function NotificationDrawer() {
  const t = useT();
  const router = useRouter();
  const drawer = useActions((s) => s.drawer);
  const setDrawer = useActions((s) => s.setDrawer);
  const visible = drawer === 'notifications';
  const q = useNotifications(visible);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const raw = q.data?.pages.flatMap((p) => p.results) ?? [];
  const items: NotificationItem[] = raw.map((n) => {
    const d = (n.data && typeof n.data === 'object' ? n.data : {}) as Record<string, unknown>;
    const action = typeof d.action === 'string' ? d.action : '';
    // REQ-11: a blank server title falls back to plain words for the kind (key notes by what happened).
    const fallback = n.kind === 'KEY_TASK' && KEY_ACTIONS.has(action) ? t(`notifications.keyAction.${action}`) : t(`notifications.kind.${n.kind}`, { defaultValue: t('notifications.title') });
    return {
      id: n.id,
      title: n.title?.trim() || fallback,
      body: n.body,
      createdAt: n.created_at,
      read: n.is_read,
      icon: notificationIcon(n.kind),
      tone: URGENT.has(n.kind) || d.priority === 'URGENT' ? 'urgent' : 'normal',
    };
  });

  return (
    <SideDrawer
      testID="notification-drawer"
      visible={visible}
      onClose={() => setDrawer(null)}
      title={t('notifications.title')}
      headerRight={
        items.some((i) => !i.read) ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => markAll.mutate()}>
            <Text className="text-xs font-bold text-teal-700">{t('notifications.markAll')}</Text>
          </Pressable>
        ) : null
      }
    >
      <NotificationList
        items={items}
        loading={q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
        footerNote={isExpoGo ? t('notifications.pushUnavailable') : null}
        onOpen={(item) => {
          const n = raw.find((r) => r.id === item.id);
          if (!n) return;
          if (!n.is_read) markRead.mutate(n.id);
          analytics.track('notification_opened', { notification_id: n.id, kind: n.kind });
          const href = notificationHref(n.kind, n.data);
          setDrawer(null);
          if (href) router.push(href as never);
        }}
      />
    </SideDrawer>
  );
}
