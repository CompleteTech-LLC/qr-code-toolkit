// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../src/client/App';
import { defaultDesignConfig } from '../src/qr/design';

const record = {
  id: 'example-id', name: 'Saved example', mode: 'dynamic_url', contentType: 'url',
  contentPayload: { url: 'https://example.com/old' }, encodedPayload: 'https://example.com/r/example',
  designConfig: defaultDesignConfig, sizePx: 300, status: 'active', createdAt: '2026-01-01', updatedAt: '2026-01-01'
};

afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });

it('loads a saved record for editing and patches it, then refreshes detail and audit history', async () => {
  let current = { ...record };
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/qr/custom') return { ok: true, blob: async () => new Blob(['svg']) };
    if (url === '/api/qr-codes') return { ok: true, json: async () => [current] };
    if (url.endsWith('/stats')) return { ok: true, json: async () => ({ scans: 0 }) };
    if (options?.method === 'PATCH') {
      current = { ...current, ...JSON.parse(String(options.body)), updatedAt: '2026-01-02' };
      return { ok: true, json: async () => current };
    }
    return { ok: true, json: async () => ({ qr: current, auditEvents: [{ id: 'event', eventType: 'updated', actorId: 'system', createdAt: '2026-01-02', previous: null, next: current }] }) };
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); };
  await act(async () => { root.render(React.createElement(App)); });
  await flush();
  const click = async (text: string) => {
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent?.includes(text));
    expect(button).toBeTruthy();
    await act(async () => { button!.click(); });
    await flush();
  };
  await click('Saved example');
  await click('Edit QR');
  expect((container.querySelector('input[value="https://example.com/old"]') as HTMLInputElement)).toBeTruthy();
  await click('Update saved QR');
  const patch = fetchMock.mock.calls.find(([, options]) => options?.method === 'PATCH');
  expect(patch?.[0]).toBe('/api/qr-codes/example-id');
  expect(JSON.parse(String(patch?.[1]?.body)).contentPayload).toEqual(record.contentPayload);
  expect(container.textContent).toContain('Audit history');
  expect(container.textContent).toContain('updated');
  expect(container.querySelector('.selected img')?.getAttribute('src')).toContain('2026-01-02');
  await act(async () => { root.unmount(); });
});

it('ignores an obsolete detail response and keeps the edit target stable', async () => {
  const a = { ...record, id: 'a', name: 'Record A' };
  const b = { ...record, id: 'b', name: 'Record B', contentPayload: { url: 'https://example.com/b' } };
  let resolveB!: (value: unknown) => void;
  const delayedB = new Promise((resolve) => { resolveB = resolve; });
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/qr/custom') return { ok: true, blob: async () => new Blob(['svg']) };
    if (url === '/api/qr-codes') return { ok: true, json: async () => [a, b] };
    if (url.endsWith('/stats')) return { ok: true, json: async () => ({}) };
    if (options?.method === 'PATCH') return { ok: true, json: async () => a };
    if (url === '/api/qr-codes/b') return delayedB;
    return { ok: true, json: async () => ({ qr: a, auditEvents: [] }) };
  });
  vi.stubGlobal('fetch', fetchMock); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); };
  const click = async (text: string) => { const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text)); expect(button).toBeTruthy(); await act(async () => { button!.click(); }); await flush(); };
  try {
    await act(async () => { root.render(React.createElement(App)); }); await flush();
    await click('Record B'); await click('Record A'); await click('Edit QR');
    await act(async () => { resolveB({ ok: true, json: async () => ({ qr: b, auditEvents: [] }) }); }); await flush();
    expect(container.textContent).toContain('Editing Record A');
    await click('Update saved QR');
    expect(fetchMock.mock.calls.find(([, options]) => options?.method === 'PATCH')?.[0]).toBe('/api/qr-codes/a');
  } finally { await act(async () => { root.unmount(); }); }
});

it('clears a recovered preview error without hiding a records authentication error', async () => {
  let previewFails = true;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/qr-codes') return { ok: false, status: 401 };
    if (previewFails) return { ok: false, json: async () => ({ error: 'Preview unavailable' }) };
    return { ok: true, blob: async () => new Blob(['svg']) };
  }));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); URL.createObjectURL = vi.fn(() => 'blob:preview');
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); };
  try {
    await act(async () => { root.render(React.createElement(App)); }); await flush();
    expect(container.textContent).toContain('Preview unavailable'); expect(container.textContent).toContain('Admin token required');
    previewFails = false;
    const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes('Preview'))!;
    await act(async () => { button.click(); }); await flush();
    expect(container.textContent).not.toContain('Preview unavailable'); expect(container.textContent).toContain('Admin token required');
  } finally { await act(async () => { root.unmount(); }); }
});
