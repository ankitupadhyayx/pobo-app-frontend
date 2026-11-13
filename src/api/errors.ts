/**
 * Maps the backend error envelope `{"error": {"code", "message", "fields", "details"}}`
 * to a typed ApiError that screens use for inline field errors (never alerts).
 */
export type FieldErrors = Record<string, string>;

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[] | string>;
    details?: unknown;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** First message per field, keyed by backend field name (nested keys use dots: `contacts.0.phone`). */
  readonly fields: FieldErrors;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, fields: FieldErrors = {}, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.details = details;
  }

  /** True when the request never reached the server (offline, DNS, refused). */
  get isNetwork(): boolean {
    return this.code === 'network_error';
  }

  hasFieldErrors(): boolean {
    return Object.keys(this.fields).length > 0;
  }
}

export function isErrorEnvelope(body: unknown): body is ErrorEnvelope {
  return (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as ErrorEnvelope).error === 'object' &&
    (body as ErrorEnvelope).error !== null &&
    typeof (body as ErrorEnvelope).error.code === 'string'
  );
}

function flattenFields(raw: Record<string, string[] | string> | undefined): FieldErrors {
  const out: FieldErrors = {};
  if (!raw) return out;
  for (const [key, val] of Object.entries(raw)) {
    const msg = Array.isArray(val) ? val[0] : val;
    if (msg) out[key] = String(msg);
  }
  return out;
}

const STATUS_FALLBACK: Record<number, string> = {
  400: 'Some details need fixing.',
  401: 'Your session has ended. Please log in again.',
  403: "You don't have access to this.",
  404: 'This record is no longer available.',
  409: 'Someone else changed this first. Refresh and try again.',
  429: 'Too many attempts. Wait a minute and try again.',
};

export function toApiError(status: number, body: unknown): ApiError {
  if (isErrorEnvelope(body)) {
    const { code, message, fields, details } = body.error;
    return new ApiError(status, code, message || STATUS_FALLBACK[status] || 'Request failed.', flattenFields(fields), details);
  }
  const message =
    STATUS_FALLBACK[status] ?? (status >= 500 ? 'POBO servers are having trouble. Try again in a moment.' : 'Request failed.');
  return new ApiError(status, status >= 500 ? 'server_error' : 'error', message);
}

export function networkError(cause?: unknown): ApiError {
  const err = new ApiError(0, 'network_error', "Can't reach POBO. Check your internet and try again.");
  (err as { cause?: unknown }).cause = cause;
  return err;
}

/** Message suitable for an inline banner. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

/** Field error for a form input; falls back to matching the last dotted segment. */
export function fieldError(err: unknown, field: string): string | undefined {
  if (!(err instanceof ApiError)) return undefined;
  return err.fields[field];
}
