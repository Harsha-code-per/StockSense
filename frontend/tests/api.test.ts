import assert from 'node:assert/strict';
import { test } from 'node:test';
import { api, ApiError } from '../src/lib/api.ts';

test('API keeps requests same-origin, preserves server errors, and handles empty responses', async () => {
  const original = globalThis.fetch;
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ id: 12, on_hand: '77.000' }));
  };
  try {
    assert.deepEqual(await api('/api/products/12'), {
      id: 12,
      on_hand: '77.000',
    });
    assert.equal(calls[0].init?.credentials, 'same-origin');
    await assert.rejects(() => api('https://example.com/api/products'));
    await assert.rejects(() => api('/api/../private'));
    assert.equal(calls.length, 1);
    globalThis.fetch = async () => new Response(null, { status: 204 });
    assert.equal(await api('/api/auth/logout', { method: 'POST' }), undefined);
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          code: 'DUPLICATE',
          message: 'SKU taken',
          details: { field: 'sku' },
          field_errors: [{ field: 'sku', message: 'Already exists' }],
        }),
        { status: 409 },
      );
    await assert.rejects(
      () => api('/api/products'),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.code, 'DUPLICATE');
        assert.equal(error.status, 409);
        assert.equal(error.field_errors[0].field, 'sku');
        return true;
      },
    );
    globalThis.fetch = async () =>
      new Response('<html>proxy failed</html>', { status: 502 });
    await assert.rejects(() => api('/api/products'), /Request failed/);
  } finally {
    globalThis.fetch = original;
  }
});
