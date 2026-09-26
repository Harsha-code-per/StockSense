import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_AFTER_LOGIN, safeNext } from '../src/lib/session.ts';

test('safeNext keeps same-site paths and blocks open redirects', () => {
  assert.equal(safeNext('/products?search=steel'), '/products?search=steel');
  assert.equal(safeNext('/operations/receipts/12'), '/operations/receipts/12');
  for (const bad of [
    undefined,
    '',
    ['/', '/x'],
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    '/login',
    '/login?next=/x',
    '/signup',
    '/forgot-password',
  ]) {
    assert.equal(safeNext(bad), DEFAULT_AFTER_LOGIN, String(bad));
  }
});
