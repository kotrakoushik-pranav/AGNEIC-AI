import axios, { AxiosError } from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// ── Typed API Error ────────────────────────────────────────────────────────────

export type ApiErrorKind = 'not_found' | 'bad_request' | 'server_error' | 'network_error' | 'timeout' | 'unknown';

export class ApiError extends Error {
  /** HTTP status code, or 0 for network/timeout errors. */
  readonly status: number;
  /** Broad error category for conditional handling in components. */
  readonly kind: ApiErrorKind;
  /** Raw detail string from the backend response body, if available. */
  readonly detail: string | null;

  constructor(message: string, status: number, kind: ApiErrorKind, detail: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind;
    this.detail = detail;
  }

  /** True for any 4xx or 5xx status. */
  get isHttpError(): boolean {
    return this.status >= 400;
  }
}

function classifyAxiosError(error: AxiosError): ApiError {
  if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
    return new ApiError(
      `Cannot reach backend at ${baseURL}. Is the server running?`,
      0,
      error.code === 'ECONNABORTED' ? 'timeout' : 'network_error',
    );
  }

  if (!error.response) {
    return new ApiError(
      `Cannot reach backend at ${baseURL}. Is the server running?`,
      0,
      'network_error',
    );
  }

  const status = error.response.status;
  const detail = (error.response.data as { detail?: string })?.detail ?? null;

  if (status === 404) {
    return new ApiError(detail ?? 'Resource not found', status, 'not_found', detail);
  }
  if (status === 400) {
    return new ApiError(detail ?? 'Bad request', status, 'bad_request', detail);
  }
  if (status >= 500) {
    return new ApiError(detail ?? 'Server error — check that the backend is running', status, 'server_error', detail);
  }

  return new ApiError(detail ?? error.message, status, 'unknown', detail);
}

// ── Axios Client ───────────────────────────────────────────────────────────────

export const apiClient = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const apiError = classifyAxiosError(error);
    console.error('[API Error]', apiError.kind, apiError.status, apiError.message);
    return Promise.reject(apiError);
  },
);

export default apiClient;
