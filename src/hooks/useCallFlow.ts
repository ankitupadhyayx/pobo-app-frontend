import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

/**
 * APP-13 dial → return → outcome.
 * We open the native dialer with `tel:`; when the app comes back to the foreground after a dial
 * we hand back the target so the caller can auto-open the outcome sheet. No telephony
 * integration exists yet (blueprint §24), so call duration is the time away from the app.
 */
export interface CallTarget {
  customerId: string;
  requirementId?: string;
  phone: string;
}

export interface ReturnedCall extends CallTarget {
  startedAt: number;
  awaySeconds: number;
}

export function useCallFlow(onReturn: (call: ReturnedCall) => void) {
  const pending = useRef<{ target: CallTarget; startedAt: number; leftApp: boolean } | null>(null);
  const [dialError, setDialError] = useState<string | null>(null);
  const cb = useRef(onReturn);
  useEffect(() => {
    cb.current = onReturn;
  }, [onReturn]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const p = pending.current;
      if (!p) return;
      if (state === 'background' || state === 'inactive') {
        p.leftApp = true;
      } else if (state === 'active' && p.leftApp) {
        pending.current = null;
        cb.current({ ...p.target, startedAt: p.startedAt, awaySeconds: Math.round((Date.now() - p.startedAt) / 1000) });
      }
    });
    return () => sub.remove();
  }, []);

  const dial = useCallback(async (target: CallTarget) => {
    setDialError(null);
    const url = `tel:${target.phone.replace(/[^\d+]/g, '')}`;
    pending.current = { target, startedAt: Date.now(), leftApp: false };
    try {
      await Linking.openURL(url);
    } catch {
      pending.current = null;
      setDialError("Couldn't open the dialer on this phone. Dial the number manually, then log the call.");
      return false;
    }
    return true;
  }, []);

  /** If the dialer never took focus (e.g. tablet), let the user log manually. */
  const cancel = useCallback(() => {
    pending.current = null;
  }, []);

  return { dial, cancel, dialError };
}
