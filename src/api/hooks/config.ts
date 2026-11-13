import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { unwrap } from '../client';
import { api } from '../instance';
import { qk } from '../keys';
import type { AppConfig, MasterItem } from '../types';
import type { Option } from '@/components/ui/Chips';
import type { MetaOption } from '@/components/sheets/types';

/** APP-06: settings, master lists and enum labels. Cached; refreshed every 10 minutes. */
export function useConfig(enabled = true) {
  return useQuery({
    queryKey: qk.config,
    enabled,
    staleTime: 10 * 60_000,
    queryFn: () => unwrap(api.GET('/api/v1/config/app')),
  });
}

type EnumItem = { code: string; label: string; label_hi?: string };

function meta(item: MasterItem): Record<string, unknown> {
  return item.metadata && typeof item.metadata === 'object' ? (item.metadata as Record<string, unknown>) : {};
}

/**
 * Label lookups. Never hardcode business labels in screens: stages, intents, outcomes,
 * reasons and glossary terms all come from here so Ops can rename them centrally.
 */
export function useLabels() {
  const { data } = useConfig();
  const { i18n } = useTranslation();
  const hi = i18n.language === 'hi';
  const cfg = data as AppConfig | undefined;

  const pick = useCallback((i: { label: string; label_hi?: string }) => (hi && i.label_hi ? i.label_hi : i.label), [hi]);

  const enumLabel = useCallback(
    (name: string, code: string | null | undefined): string => {
      if (!code) return '';
      const list = (cfg?.enums?.[name] as EnumItem[] | undefined) ?? [];
      const hit = Array.isArray(list) ? list.find((e) => e.code === code) : undefined;
      return hit ? pick(hit) : humanize(code);
    },
    [cfg, pick],
  );

  const master = useCallback(
    (list: string, code: string | null | undefined): string => {
      if (!code) return '';
      const hit = cfg?.master_lists?.[list]?.find((m) => m.code === code);
      return hit ? pick(hit) : humanize(code);
    },
    [cfg, pick],
  );

  /** Options for chips/selects. Items flagged `system_only` (e.g. SLA_BREACH escalation) are excluded. */
  const options = useCallback(
    (list: string): MetaOption[] =>
      (cfg?.master_lists?.[list] ?? []).filter((m) => !meta(m).system_only).map((m) => ({ value: m.code, label: pick(m), meta: meta(m) })),
    [cfg, pick],
  );

  const enumOptions = useCallback(
    (name: string, only?: string[]): Option[] => {
      const list = (cfg?.enums?.[name] as EnumItem[] | undefined) ?? [];
      const items = (Array.isArray(list) ? list : []).filter((e) => !only || only.includes(e.code)).map((e) => ({ value: e.code, label: pick(e) }));
      // An enum the server hasn't sent yet (older config cache) still offers the known codes.
      return items.length || !only ? items : only.map((c) => ({ value: c, label: humanize(c) }));
    },
    [cfg, pick],
  );

  /** Glossary term: label + definition (blueprint: every in-app term is in the glossary). */
  const glossary = useCallback(
    (code: string, fallback: string) => {
      const hit = cfg?.master_lists?.GLOSSARY?.find((m) => m.code === code);
      return { label: hit ? pick(hit) : fallback, definition: hit ? (meta(hit).definition as string | undefined) : undefined };
    },
    [cfg, pick],
  );

  const setting = useCallback(<T,>(key: string, fallback: T): T => (cfg?.settings?.[key] as T | undefined) ?? fallback, [cfg]);

  const transitions = useMemo(
    () => (cfg?.enums?.requirement_status_transitions as Record<string, string[]> | undefined) ?? {},
    [cfg],
  );

  return { ready: !!cfg, enumLabel, master, options, enumOptions, glossary, setting, transitions, hi, pick };
}

/** "RENT_OUT" → "Rent out" when config hasn't loaded (never shown as a raw code). */
export function humanize(code: string): string {
  const s = code.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
