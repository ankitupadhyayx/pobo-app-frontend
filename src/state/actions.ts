import { create } from 'zustand';

/** Which action sheet / drawer is open. Data for the sheet is fetched by ActionHost. */
export type Sheet =
  | { kind: 'call'; relationshipId: string; requirementId?: string | null; awaySeconds?: number; startedAt?: string }
  | { kind: 'followUp'; relationshipId: string; requirementId?: string | null }
  | { kind: 'complete'; followUpId: string; relationshipId?: string | null; title?: string }
  | { kind: 'transfer'; relationshipId: string; requirementId?: string | null; mode: 'REQUIREMENT' | 'RELATIONSHIP' }
  | { kind: 'escalate'; relationshipId?: string | null; requirementId?: string | null }
  | { kind: 'message'; relationshipId: string; requirementId?: string | null }
  | { kind: 'addRequirement'; relationshipId: string }
  | { kind: 'referral' };

export interface DialTarget {
  relationshipId: string;
  requirementId?: string | null;
  phone: string;
}

/** One row on the success sheet, e.g. { label: 'When', value: 'Today 4:30 PM' }. */
export interface SuccessLine {
  label?: string;
  value: string;
}
export interface SuccessAction {
  label: string;
  onPress: () => void;
  testID?: string;
}
/**
 * Completion feedback (REVISION1 ground rule). A message with only a title shows as a toast;
 * with details or actions it shows as a success sheet with a Done button.
 */
export interface SuccessMessage {
  title: string;
  body?: string;
  lines?: SuccessLine[];
  actions?: SuccessAction[];
}

interface ActionsState {
  sheet: Sheet | null;
  drawer: null | 'profile' | 'notifications';
  /** Short confirmation shown after a sheet saves (e.g. "Call saved"). */
  toast: string | null;
  /** Error tone for the toast (R2-8: failed save says so straight away). */
  toastTone: 'success' | 'error';
  /** Success sheet (details + next actions). See SuccessHost. */
  success: SuccessMessage | null;
  /** Set by ActionHost: opens the dialer and auto-opens the outcome sheet on return. */
  dial: (t: DialTarget) => void;
  open: (s: Sheet) => void;
  close: () => void;
  setDrawer: (d: ActionsState['drawer']) => void;
  showToast: (msg: string) => void;
  /** R2-8: same toast, error tone ("Fix 2 fields to save"). */
  showError: (msg: string) => void;
  clearToast: () => void;
  /** Toast when only a title is given, success sheet otherwise. */
  showSuccess: (msg: SuccessMessage) => void;
  clearSuccess: () => void;
  setDial: (fn: (t: DialTarget) => void) => void;
}

export const useActions = create<ActionsState>((set) => ({
  sheet: null,
  drawer: null,
  toast: null,
  toastTone: 'success',
  success: null,
  dial: () => {},
  open: (sheet) => set({ sheet, drawer: null }),
  close: () => set({ sheet: null }),
  setDrawer: (drawer) => set({ drawer }),
  showToast: (toast) => set({ toast, toastTone: 'success' }),
  showError: (toast) => set({ toast, toastTone: 'error' }),
  clearToast: () => set({ toast: null }),
  showSuccess: (msg) => (msg.body || msg.lines?.length || msg.actions?.length ? set({ success: msg, toast: null }) : set({ toast: msg.title, toastTone: 'success' })),
  clearSuccess: () => set({ success: null }),
  setDial: (dial) => set({ dial }),
}));
