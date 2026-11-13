import { Text, View } from 'react-native';
import { Ban, Clock, Mail, Phone, User } from 'lucide-react-native';
import { StagePill } from '@/components/ui';
import type { RelationshipDetail } from '@/api/types';
import { useLabels } from '@/api/hooks/config';
import { formatAgo } from '@/lib/time';
import { colors } from '@/theme/colors';
import { useT } from '@/i18n';

/** One customer identity on top; requirements are separate cards below (blueprint §22). */
export function CustomerHeader({ rel }: { rel: RelationshipDetail }) {
  const t = useT();
  const L = useLabels();
  const dnc = !!rel.customer.dnc;
  const owner = L.glossary('RELATIONSHIP_OWNER', 'Relationship Owner').label;
  return (
    <View className="gap-3 rounded-3xl border border-slate-200 bg-white p-5">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text testID="lead-name" className="text-xl font-extrabold tracking-tight text-slate-900">
            {rel.customer.name}
          </Text>
          <View className="mt-1 flex-row flex-wrap items-center gap-x-3 gap-y-1">
            <View className="flex-row items-center gap-1">
              <Phone size={12} color={colors.muted} />
              <Text className="text-xs font-semibold text-slate-700">{rel.customer.phone || rel.customer.phone_masked}</Text>
            </View>
            {rel.customer.email ? (
              <View className="flex-row items-center gap-1">
                <Mail size={12} color={colors.muted} />
                <Text className="text-xs text-slate-600">{rel.customer.email}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <StagePill status={dnc ? 'DNC' : rel.stage} label={dnc ? L.glossary('DNC', 'Do Not Contact').label : L.enumLabel('requirement_status', rel.stage)} />
      </View>

      {dnc ? (
        <View testID="dnc-banner" className="flex-row items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3">
          <Ban size={16} color={colors.danger} />
          <Text className="flex-1 text-xs font-medium text-rose-800">{t('lead.dncBanner')}</Text>
        </View>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        <View className="flex-row items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1">
          <User size={13} color={colors.brandDark} />
          <Text className="text-[11px] font-bold text-teal-900">
            {owner}: {rel.is_owner ? t('lead.you') : (rel.owner?.name ?? '—')}
          </Text>
        </View>
        {rel.original_source ? (
          <View className="rounded-lg bg-slate-100 px-2 py-1">
            <Text className="text-[11px] font-medium text-slate-700">
              {t('lead.source')}: <Text className="font-bold">{L.master('LEAD_SOURCE', rel.original_source)}</Text>
            </Text>
          </View>
        ) : null}
        {rel.last_activity_at ? (
          <View className="flex-row items-center gap-1 rounded-lg bg-slate-100 px-2 py-1">
            <Clock size={11} color={colors.slate400} />
            <Text className="text-[11px] font-medium text-slate-600">{formatAgo(rel.last_activity_at)}</Text>
          </View>
        ) : null}
      </View>

      {rel.contacts.length ? (
        <View className="gap-1.5 border-t border-slate-100 pt-3">
          <Text className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{t('lead.contacts')}</Text>
          {rel.contacts.map((c) => (
            <View key={c.id} className="flex-row items-center justify-between gap-2">
              <View className="flex-1">
                <Text className="text-sm font-semibold text-slate-800">
                  {c.name} <Text className="text-xs font-normal text-slate-500">· {L.enumLabel('contact_role', c.role)}</Text>
                </Text>
                {c.phone ? <Text className="text-xs text-slate-600">{c.phone}</Text> : null}
                {c.address ? <Text className="text-[11px] text-slate-500">{c.address}</Text> : null}
              </View>
              <View className={c.priority === 'PRIMARY' ? 'rounded-full bg-teal-600 px-2 py-0.5' : 'rounded-full bg-slate-200 px-2 py-0.5'}>
                <Text className={c.priority === 'PRIMARY' ? 'text-[10px] font-bold text-white' : 'text-[10px] font-bold text-slate-700'}>
                  {c.priority === 'PRIMARY' ? t('lead.primaryContact') : t('lead.secondaryContact')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
