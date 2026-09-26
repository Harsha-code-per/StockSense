import type { ApiErrorBody, FieldError } from './types.ts';

export class ApiError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;
  field_errors: FieldError[];
  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details;
    this.field_errors = body.field_errors;
  }
}

export async function api<T = void>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = new URL(path, 'http://same-origin.invalid');
  if (
    !path.startsWith('/api/') ||
    url.origin !== 'http://same-origin.invalid' ||
    !url.pathname.startsWith('/api/') ||
    path.includes('\\')
  ) {
    throw new Error('API requests must use relative /api/ URLs.');
  }
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, {
      code: typeof body?.code === 'string' ? body.code : 'REQUEST_FAILED',
      message:
        typeof body?.message === 'string'
          ? body.message
          : 'Request failed. Please try again.',
      details:
        body?.details && typeof body.details === 'object' ? body.details : {},
      field_errors: Array.isArray(body?.field_errors)
        ? body.field_errors.filter(
            (item: FieldError) =>
              typeof item?.field === 'string' &&
              typeof item?.message === 'string',
          )
        : [],
    });
  }
  if (body === null)
    throw new Error(
      'The server returned an invalid response. Please try again.',
    );
  return body as T;
}
