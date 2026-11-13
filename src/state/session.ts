import { create } from 'zustand';

/**
 * Minimal client-only session state. Server data (/me, config, leads) lives in TanStack Query.
 *  - booting:   reading tokens from secure store
 *  - signedOut: no/invalid tokens → login
 *  - signedIn:  tokens present; /me decides onboarding vs app
 */
export type SessionStatus = 'booting' | 'signedOut' | 'signedIn';

interface SessionState {
  status: SessionStatus;
  /** Set when the server rejected our refresh token (shown once on the login screen). */
  expired: boolean;
  setStatus: (s: SessionStatus, opts?: { expired?: boolean }) => void;
}

export const useSession = create<SessionState>((set) => ({
  status: 'booting',
  expired: false,
  setStatus: (status, opts) => set({ status, expired: opts?.expired ?? false }),
}));
