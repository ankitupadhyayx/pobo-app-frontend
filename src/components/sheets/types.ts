import type { Option } from '@/components/ui';

export interface SheetBaseProps<T> {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: T) => Promise<unknown>;
}

/** Master-list option with its config metadata (e.g. CALL_OUTCOME.requires_next_action). */
export interface MetaOption extends Option {
  meta?: Record<string, unknown>;
}
