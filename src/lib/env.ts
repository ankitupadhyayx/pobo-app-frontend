/**
 * Runtime configuration. Only EXPO_PUBLIC_* vars are inlined into the JS bundle.
 * Android emulator: http://10.0.2.2:8000/api/v1 · phone on Wi-Fi: http://<Mac LAN IP>:8000/api/v1
 */
const DEFAULT_API_URL = 'http://localhost:8000/api/v1';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

/** openapi paths already include `/api/v1`, so the generated client needs just the origin. */
export const API_ORIGIN = API_URL.replace(/\/api\/v\d+$/, '');
