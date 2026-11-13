import { useCallback, useState } from 'react';
import { ApiError, errorMessage } from '@/api/errors';
import type { FormFocus } from './useFormFocus';

/**
 * Sheet submit helper: tracks busy state and the last error so the sheet can show
 * API field errors inline next to inputs and anything else in an InlineBanner.
 */
/** Pass `form` (R2-8) to announce a failed save at once (pinned notice / toast + scroll). */
export function useSubmit<T>(onSubmit: (v: T) => Promise<unknown>, onDone?: () => void, form?: FormFocus) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = useCallback(
    async (v: T) => {
      setBusy(true);
      setError(null);
      try {
        await onSubmit(v);
        onDone?.();
        return true;
      } catch (e) {
        setError(e);
        if (form) {
          const fields = e instanceof ApiError ? Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [k.split('.').pop() ?? k, v])) : {};
          form.fail(Object.keys(fields).length ? fields : { banner: errorMessage(e) }, errorMessage(e));
        }
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onSubmit, onDone, form],
  );
  const reset = useCallback(() => setError(null), []);
  /** API field error for `name` (also matches dotted keys ending in `.name`). */
  const apiField = useCallback(
    (...names: string[]) => {
      if (!(error instanceof ApiError)) return undefined;
      for (const n of names) {
        if (error.fields[n]) return error.fields[n];
        const k = Object.keys(error.fields).find((f) => f.endsWith(`.${n}`));
        if (k) return error.fields[k];
      }
      return undefined;
    },
    [error],
  );
  /** Message for the banner when the error isn't attached to a visible field. */
  const banner = (shownFields: string[]): string | null => {
    if (!error) return null;
    if (error instanceof ApiError) {
      const unshown = Object.keys(error.fields).filter((f) => !shownFields.some((s) => f === s || f.endsWith(`.${s}`)));
      if (error.hasFieldErrors() && unshown.length === 0) return null;
      if (unshown.length) return `${error.message} ${unshown.map((f) => `${f}: ${error.fields[f]}`).join(' · ')}`;
      return error.message;
    }
    return error instanceof Error ? error.message : 'Something went wrong.';
  };
  return { busy, error, run, reset, apiField, banner };
}
