/** The app's single API instance (secure-store tokens). Node scripts use createApi() directly. */
import { createApi } from './client';
import { secureTokenStore } from './secureTokens';

let sessionExpiredHandler: () => void = () => {};
export function onSessionExpired(fn: () => void) {
  sessionExpiredHandler = fn;
}

const instance = createApi({ tokenStore: secureTokenStore, onSessionExpired: () => sessionExpiredHandler() });
export const api = instance.client;
export const tokens = instance.tokenStore;
