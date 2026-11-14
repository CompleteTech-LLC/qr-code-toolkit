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

it('invalidates a draft logo upload when entering edit mode', async () => {
  let resolveUpload!: (value: unknown) => void;
  const upload = new Promise((resolve) => { resolveUpload = resolve; });
  const saved = { ...record, designConfig: { ...defaultDesignConfig, logo: '#facebook' } };
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/qr/custom') return { ok: true, blob: async () => new Blob(['svg']) };
    if (url === '/api/qr/upload-image') return upload;
    if (url === '/api/qr-codes') return { ok: true, json: async () => [saved] };
    if (url.endsWith('/stats')) return { ok: true, json: async () => ({}) };
    if (options?.method === 'PATCH') return { ok: true, json: async () => saved };
    return { ok: true, json: async () => ({ qr: saved, auditEvents: [] }) };
  });
  vi.stubGlobal('fetch', fetchMock); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); };
  const click = async (text: string) => { const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text))!; await act(async () => { button.click(); }); await flush(); };
  try {
    await act(async () => { root.render(React.createElement(App)); }); await flush();
    await click('Saved example');
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['logo'], 'logo.png', { type: 'image/png' })] });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
    expect([...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Save new QR'))?.disabled).toBe(true);
    await click('Edit QR');
    await act(async () => { resolveUpload({ ok: true, json: async () => ({ file: '/uploads/stale.png' }) }); }); await flush();
    await click('Update saved QR');
    const patch = fetchMock.mock.calls.find(([, options]) => options?.method === 'PATCH');
    expect(JSON.parse(String(patch?.[1]?.body)).designConfig.logo).toBe('#facebook');
  } finally { await act(async () => { root.unmount(); }); }
});

it('serializes saves across navigation and clears the saved keyword when creating', async () => {
  const saved = { ...record, yourlsKeyword: 'printed' };
  let resolvePatch!: (value: unknown) => void;
  const pending = new Promise((resolve) => { resolvePatch = resolve; });
  const mutations: Array<{ method: string; body: any }> = [];
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/qr/custom') return { ok: true, blob: async () => new Blob(['svg']) };
    if (url.endsWith('/stats')) return { ok: true, json: async () => ({}) };
    if (options?.method === 'PATCH' || options?.method === 'POST') {
      mutations.push({ method: options.method, body: JSON.parse(String(options.body)) });
      if (options.method === 'PATCH') return pending;
      return { ok: true, json: async () => ({ ...saved, id: 'new' }) };
    }
    if (url === '/api/qr-codes') return { ok: true, json: async () => [saved] };
    return { ok: true, json: async () => ({ qr: saved, auditEvents: [] }) };
  });
  vi.stubGlobal('fetch', fetchMock); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); };
  const button = (text: string) => [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text))!;
  const click = async (text: string) => { await act(async () => { button(text).click(); }); await flush(); };
  try {
    await act(async () => { root.render(React.createElement(App)); }); await flush();
    await click('Saved example'); await click('Edit QR'); await click('Update saved QR');
    expect(mutations).toHaveLength(1);
    expect(mutations[0].body.keyword).toBe('printed');
    await click('Cancel editing');
    expect(button('Save new QR').disabled).toBe(true);
    await click('Save new QR');
    expect(mutations).toHaveLength(1);
    await act(async () => { resolvePatch({ ok: true, json: async () => saved }); }); await flush();
    await click('Save new QR');
    expect(mutations.map((m) => m.method)).toEqual(['PATCH', 'POST']);
    expect(mutations[1].body.keyword).toBeUndefined();
    await click('Edit QR'); await click('text');
    expect((container.querySelector('input[placeholder=optional]') as HTMLInputElement).value).toBe('');
  } finally { await act(async () => { root.unmount(); }); }
});

it('does not send a newer patch until the previous server mutation completes', async () => {
  let finishFirst!: () => void;
  const first = new Promise<void>((resolve) => { finishFirst = resolve; });
  let server = { ...record };
  const sent: string[] = [];
  const completed: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/qr/custom') return { ok: true, blob: async () => new Blob(['svg']) };
    if (url === '/api/qr-codes') return { ok: true, json: async () => [server] };
    if (url.endsWith('/stats')) return { ok: true, json: async () => ({}) };
    if (options?.method === 'PATCH') {
      const body = JSON.parse(String(options.body));
      sent.push(body.name);
      if (sent.length === 1) await first;
      server = { ...server, ...body }; completed.push(body.name);
      return { ok: true, json: async () => server };
    }
    return { ok: true, json: async () => ({ qr: server, auditEvents: [] }) };
  }));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); URL.createObjectURL = vi.fn(() => 'blob:preview');
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); };
  const button = (text: string) => [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text))!;
  const click = async (text: string) => { await act(async () => { button(text).click(); }); await flush(); };
  const setName = async (value: string) => {
    const input = container.querySelector('input[value="Saved example"]') as HTMLInputElement;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
  };
  try {
    await act(async () => { root.render(React.createElement(App)); }); await flush();
    await click('Saved example'); await click('Edit QR'); await click('Update saved QR');
    await setName('Newer name');
    expect(button('Update saved QR').disabled).toBe(true);
    await click('Update saved QR');
    expect(sent).toEqual(['Saved example']); expect(completed).toEqual([]);
    await act(async () => { finishFirst(); }); await flush();
    await click('Update saved QR');
    expect(sent).toEqual(['Saved example', 'Newer name']);
    expect(completed).toEqual(['Saved example', 'Newer name']);
    expect(server.name).toBe('Newer name');
  } finally { await act(async () => { root.unmount(); }); }
});

it('blocks creation while edit detail loads and keeps the displayed record aligned with the patch', async () => {
  const a = { ...record, id: 'a', name: 'Record A', contentPayload: { url: 'https://example.com/a' } };
  const c = { ...record, id: 'c', name: 'Record C', contentPayload: { url: 'https://example.com/c' } };
  let resolveEdit!: (value: unknown) => void;
  const editDetail = new Promise((resolve) => { resolveEdit = resolve; });
  let detailCalls = 0;
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/qr/custom') return { ok: true, blob: async () => new Blob(['svg']) };
    if (url.endsWith('/stats')) return { ok: true, json: async () => ({}) };
    if (options?.method === 'POST') return { ok: true, json: async () => c };
    if (options?.method === 'PATCH') return { ok: true, json: async () => a };
    if (url === '/api/qr-codes') return { ok: true, json: async () => [a, c] };
    if (url === '/api/qr-codes/a' && ++detailCalls === 2) return editDetail;
    return { ok: true, json: async () => ({ qr: url.endsWith('/c') ? c : a, auditEvents: [] }) };
  });
  vi.stubGlobal('fetch', fetchMock); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); };
  const button = (text: string) => [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text))!;
  const click = async (text: string) => { await act(async () => { button(text).click(); }); await flush(); };
  try {
    await act(async () => { root.render(React.createElement(App)); }); await flush();
    await click('Record A'); await click('Edit QR');
    expect(button('Save new QR').disabled).toBe(true);
    await click('Save new QR');
    expect(fetchMock.mock.calls.filter(([url, options]) => url === '/api/qr-codes' && options?.method === 'POST')).toHaveLength(0);
    await act(async () => { resolveEdit({ ok: true, json: async () => ({ qr: a, auditEvents: [] }) }); }); await flush();
    expect(container.textContent).toContain('Editing Record A');
    await click('Update saved QR');
    const patch = fetchMock.mock.calls.find(([, options]) => options?.method === 'PATCH');
    expect(patch?.[0]).toBe('/api/qr-codes/a');
    expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({ name: 'Record A', contentPayload: { url: 'https://example.com/a' } });
    await click('Cancel editing'); await click('Save new QR');
    expect(container.textContent).not.toContain('Editing Record A');
    expect(container.querySelector('.selected h3')?.textContent).toBe('Record C');
  } finally { await act(async () => { root.unmount(); }); }
});

it('releases the edit loading guard on failure and ignores detail after navigation', async () => {
  let detailCalls = 0;
  let resolveEdit!: (value: unknown) => void;
  const pending = new Promise((resolve) => { resolveEdit = resolve; });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/qr/custom') return { ok: true, blob: async () => new Blob(['svg']) };
    if (url === '/api/qr-codes') return { ok: true, json: async () => [record] };
    if (url.endsWith('/stats')) return { ok: true, json: async () => ({}) };
    detailCalls++;
    if (detailCalls === 2) return { ok: false, json: async () => ({ error: 'Detail unavailable' }) };
    if (detailCalls === 3) return pending;
    return { ok: true, json: async () => ({ qr: record, auditEvents: [] }) };
  }));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); URL.createObjectURL = vi.fn(() => 'blob:preview');
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); };
  const button = (text: string) => [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text))!;
  const click = async (text: string) => { await act(async () => { button(text).click(); }); await flush(); };
  try {
    await act(async () => { root.render(React.createElement(App)); }); await flush();
    await click('Saved example'); await click('Edit QR');
    expect(container.textContent).toContain('Detail unavailable');
    expect(button('Save new QR').disabled).toBe(false);
    await click('Edit QR');
    expect(button('Save new QR').disabled).toBe(true);
    await click('text');
    expect(button('Save new QR').disabled).toBe(false);
    await act(async () => { resolveEdit({ ok: true, json: async () => ({ qr: record, auditEvents: [] }) }); }); await flush();
    expect(container.textContent).not.toContain('Editing Saved example');
    expect(button('Save new QR').disabled).toBe(false);
  } finally { await act(async () => { root.unmount(); }); }
});

it.each(['a', 'b'])('refreshes a completed patch after navigation to %s without replacing the draft', async (destination) => {
  const a = { ...record, id: 'a', name: 'Record A' };
  const b = { ...record, id: 'b', name: 'Record B' };
  const updated = { ...a, name: 'Renamed A', updatedAt: '2026-01-02' };
  let serverA = a;
  let finishPatch!: () => void;
  const patch = new Promise<void>((resolve) => { finishPatch = resolve; });
  let finishStaleDetail!: (value: unknown) => void;
  const staleDetail = new Promise((resolve) => { finishStaleDetail = resolve; });
  let aDetails = 0;
  let listCalls = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/qr/custom') return { ok: true, blob: async () => new Blob(['svg']) };
    if (url.endsWith('/stats')) return { ok: true, json: async () => ({}) };
    if (options?.method === 'PATCH') { await patch; serverA = updated; return { ok: true, json: async () => updated }; }
    if (url === '/api/qr-codes') {
      if (++listCalls === 1) return { ok: true, json: async () => [a, b] };
      return { ok: true, json: async () => [serverA, b] };
    }
    if (url === '/api/qr-codes/a') {
      if (++aDetails === 3) return staleDetail;
      return { ok: true, json: async () => ({ qr: serverA, auditEvents: serverA === updated ? [{ id: 'updated', eventType: 'updated' }] : [] }) };
    }
    return { ok: true, json: async () => ({ qr: b, auditEvents: [] }) };
  }));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); URL.createObjectURL = vi.fn(() => 'blob:preview');
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); };
  const click = async (text: string) => { const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text))!; await act(async () => { button.click(); }); await flush(); };
  const setName = async (value: string) => { const input = container.querySelector('input[value="Record A"]') as HTMLInputElement; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }); };
  try {
    await act(async () => { root.render(React.createElement(App)); }); await flush();
    await click('Record A'); await click('Edit QR'); await setName('Renamed A'); await click('Update saved QR');
    await click('Record A');
    if (destination === 'b') await click('Record B');
    await act(async () => { finishPatch(); }); await flush();
    expect(container.querySelector('.record')?.textContent).toContain('Renamed A');
    expect(container.querySelector('.selected h3')?.textContent).toBe(destination === 'a' ? 'Renamed A' : 'Record B');
    expect((container.querySelector('input[value="Renamed A"]') as HTMLInputElement)?.value).toBe('Renamed A');
    await act(async () => { finishStaleDetail({ ok: true, json: async () => ({ qr: a, auditEvents: [] }) }); }); await flush();
    expect(container.querySelector('.selected h3')?.textContent).toBe(destination === 'a' ? 'Renamed A' : 'Record B');
  } finally { await act(async () => { root.unmount(); }); }
});

it('ignores an older list response after a successful creation refresh', async () => {
  let resolveOld!: (value: unknown) => void;
  const oldList = new Promise((resolve) => { resolveOld = resolve; });
  let lists = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/qr/custom') return { ok: true, blob: async () => new Blob(['svg']) };
    if (url.endsWith('/stats')) return { ok: true, json: async () => ({}) };
    if (options?.method === 'POST') return { ok: true, json: async () => record };
    if (url === '/api/qr-codes') return ++lists === 1 ? oldList : { ok: true, json: async () => [record] };
    return { ok: true, json: async () => ({ qr: record, auditEvents: [] }) };
  }));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); URL.createObjectURL = vi.fn(() => 'blob:preview');
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); };
  try {
    await act(async () => { root.render(React.createElement(App)); }); await flush();
    const save = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes('Save new QR'))!;
    await act(async () => { save.click(); }); await flush();
    expect(container.querySelector('.record')?.textContent).toContain('Saved example');
    await act(async () => { resolveOld({ ok: true, json: async () => [] }); }); await flush();
    expect(container.querySelector('.record')?.textContent).toContain('Saved example');
  } finally { await act(async () => { root.unmount(); }); }
});

it('reports a failed list refresh while still refreshing detail after a successful patch', async () => {
  const updated = { ...record, name: 'Updated record' };
  let saved = false;
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/qr/custom') return { ok: true, blob: async () => new Blob(['svg']) };
    if (url.endsWith('/stats')) return { ok: true, json: async () => ({}) };
    if (options?.method === 'PATCH') { saved = true; return { ok: true, json: async () => updated }; }
    if (url === '/api/qr-codes') return saved ? { ok: false, status: 500 } : { ok: true, json: async () => [record] };
    return { ok: true, json: async () => ({ qr: saved ? updated : record, auditEvents: [] }) };
  }));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); URL.createObjectURL = vi.fn(() => 'blob:preview');
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); };
  const click = async (text: string) => { const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text))!; await act(async () => { button.click(); }); await flush(); };
  try {
    await act(async () => { root.render(React.createElement(App)); }); await flush();
    await click('Saved example'); await click('Edit QR'); await click('Update saved QR');
    expect(container.querySelector('.selected h3')?.textContent).toBe('Updated record');
    expect(container.textContent).toContain('Could not load saved QR codes');
  } finally { await act(async () => { root.unmount(); }); }
});

it('clears discarded draft errors on successful edit initialization, but retains them if loading fails', async () => {
  let detailCalls = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/qr/custom') return { ok: false, json: async () => ({ error: 'Preview unavailable' }) };
    if (url === '/api/qr-codes') return { ok: true, json: async () => [record] };
    if (url === '/api/qr/upload-image') return { ok: false, json: async () => ({ error: 'Upload rejected' }) };
    if (url.endsWith('/stats')) return { ok: true, json: async () => ({}) };
    if (++detailCalls === 2) return { ok: false, json: async () => ({ error: 'Detail unavailable' }) };
    return { ok: true, json: async () => ({ qr: record, auditEvents: [] }) };
  }));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); };
  const click = async (text: string) => { const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text))!; await act(async () => { button.click(); }); await flush(); };
  try {
    await act(async () => { root.render(React.createElement(App)); }); await flush();
    await click('Saved example');
    const textarea = container.querySelector('textarea')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, '{'); textarea.dispatchEvent(new Event('input', { bubbles: true })); });
    const file = container.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(file, 'files', { configurable: true, value: [new File(['logo'], 'logo.png', { type: 'image/png' })] });
    await act(async () => { file.dispatchEvent(new Event('change', { bubbles: true })); }); await flush();
    expect(container.textContent).toContain('Payload JSON is invalid');
    expect(container.textContent).toContain('Upload rejected');
    await click('Edit QR');
    expect(container.textContent).toContain('Detail unavailable');
    expect(container.textContent).toContain('Payload JSON is invalid');
    expect(container.textContent).toContain('Upload rejected');
    await click('Edit QR');
    expect(container.textContent).toContain('Editing Saved example');
    expect(container.textContent).not.toContain('Payload JSON is invalid');
    expect(container.textContent).not.toContain('Upload rejected');
    expect(container.textContent).not.toContain('Detail unavailable');
    expect(container.textContent).toContain('Preview unavailable');
    expect((container.querySelector('textarea') as HTMLTextAreaElement).value).toContain('https://example.com/old');
  } finally { await act(async () => { root.unmount(); }); }
});

it('clears a failed patch when navigating to another edit while retaining a list authentication error', async () => {
  const a = { ...record, id: 'a', name: 'Record A' };
  const b = { ...record, id: 'b', name: 'Record B' };
  let listCalls = 0;
  let patchCalls = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/qr/custom') return { ok: true, blob: async () => new Blob(['svg']) };
    if (url.endsWith('/stats')) return { ok: true, json: async () => ({}) };
    if (options?.method === 'PATCH') return ++patchCalls === 1
      ? { ok: true, json: async () => a }
      : { ok: false, json: async () => ({ error: 'Patch A failed' }) };
    if (url === '/api/qr-codes') return ++listCalls === 1
      ? { ok: true, json: async () => [a, b] }
      : { ok: false, status: 401 };
    return { ok: true, json: async () => ({ qr: url.endsWith('/b') ? b : a, auditEvents: [] }) };
  }));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); URL.createObjectURL = vi.fn(() => 'blob:preview');
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); };
  const click = async (text: string) => { const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text))!; await act(async () => { button.click(); }); await flush(); };
  try {
    await act(async () => { root.render(React.createElement(App)); }); await flush();
    await click('Record A'); await click('Edit QR'); await click('Update saved QR'); await click('Update saved QR');
    expect(container.textContent).toContain('Patch A failed');
    expect(container.textContent).toContain('Admin token required');
    await click('Record B');
    expect(container.textContent).not.toContain('Patch A failed');
    expect(container.textContent).toContain('Admin token required');
    await click('Edit QR');
    expect(container.textContent).toContain('Editing Record B');
    expect(container.textContent).not.toContain('Patch A failed');
    expect(container.textContent).toContain('Admin token required');
  } finally { await act(async () => { root.unmount(); }); }
});

it.each(['success', 'failure', 'navigation'])('does not edit the previous selection while the new detail has %s', async (outcome) => {
  const a = { ...record, id: 'a', name: 'Record A' };
  const b = { ...record, id: 'b', name: 'Record B' };
  let resolveB!: (value: unknown) => void;
  const pending = new Promise((resolve) => { resolveB = resolve; });
  const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/qr/custom') return { ok: true, blob: async () => new Blob(['svg']) };
    if (url === '/api/qr-codes') return { ok: true, json: async () => [a, b] };
    if (url.endsWith('/stats')) return { ok: true, json: async () => ({}) };
    if (options?.method === 'PATCH') return { ok: true, json: async () => b };
    if (url === '/api/qr-codes/b') return pending;
    return { ok: true, json: async () => ({ qr: a, auditEvents: [] }) };
  });
  vi.stubGlobal('fetch', fetchMock); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); URL.createObjectURL = vi.fn(() => 'blob:preview');
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); };
  const button = (text: string) => [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text))!;
  const click = async (text: string) => { await act(async () => { button(text).click(); }); await flush(); };
  try {
    await act(async () => { root.render(React.createElement(App)); }); await flush();
    await click('Record A'); await click('Record B');
    expect(button('Edit QR').disabled).toBe(true);
    expect(button('Refresh record').disabled).toBe(true);
    await click('Edit QR');
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/qr-codes/a')).toHaveLength(1);
    if (outcome === 'navigation') await click('text');
    await act(async () => { resolveB(outcome === 'failure' ? { ok: false, json: async () => ({ error: 'B unavailable' }) } : { ok: true, json: async () => ({ qr: b, auditEvents: [] }) }); }); await flush();
    if (outcome === 'success') {
      expect(container.querySelector('.selected h3')?.textContent).toBe('Record B');
      await click('Edit QR'); await click('Update saved QR');
      expect(fetchMock.mock.calls.find(([, options]) => options?.method === 'PATCH')?.[0]).toBe('/api/qr-codes/b');
    } else {
      expect(button('Edit QR').disabled).toBe(true);
      expect(container.textContent).not.toContain('Editing Record A');
      if (outcome === 'failure') expect(container.textContent).toContain('B unavailable');
      await click('Record A');
      expect(button('Edit QR').disabled).toBe(false);
    }
  } finally { await act(async () => { root.unmount(); }); }
});

it.each(['facebook', 'Remove logo', 'template'])('clears an upload error when replacing the logo with %s', async (replacement) => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/qr-codes') return { ok: false, status: 401 };
    if (url === '/api/qr/upload-image') return { ok: false, json: async () => ({ error: 'Upload rejected' }) };
    return { ok: true, blob: async () => new Blob(['svg']) };
  }));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); URL.createObjectURL = vi.fn(() => 'blob:preview');
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); };
  try {
    await act(async () => { root.render(React.createElement(App)); }); await flush();
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['logo'], 'logo.png')] });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); }); await flush();
    expect(container.textContent).toContain('Upload rejected');
    const target = replacement === 'template' ? container.querySelector<HTMLButtonElement>('.template-list button') : [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === replacement);
    expect(target).toBeTruthy();
    await act(async () => { target!.click(); }); await flush();
    expect(container.textContent).not.toContain('Upload rejected');
    expect(container.textContent).toContain('Admin token required');
  } finally { await act(async () => { root.unmount(); }); }
});

it('clears abandoned detail errors on content navigation while retaining list authentication errors', async () => {
  let listCalls = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/qr/custom') return { ok: true, blob: async () => new Blob(['svg']) };
    if (url.endsWith('/stats')) return { ok: true, json: async () => ({}) };
    if (options?.method === 'POST') return { ok: true, json: async () => record };
    if (url === '/api/qr-codes') return ++listCalls === 1 ? { ok: true, json: async () => [record] } : { ok: false, status: 401 };
    return { ok: false, json: async () => ({ error: 'Detail unavailable' }) };
  }));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); URL.createObjectURL = vi.fn(() => 'blob:preview');
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); };
  const click = async (text: string) => { const button = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!; await act(async () => { button.click(); }); await flush(); };
  try {
    await act(async () => { root.render(React.createElement(App)); }); await flush();
    await click('Save new QR');
    expect(container.textContent).toContain('Detail unavailable');
    expect(container.textContent).toContain('Admin token required');
    await click('text');
    expect(container.textContent).not.toContain('Detail unavailable');
    expect(container.textContent).toContain('Admin token required');
  } finally { await act(async () => { root.unmount(); }); }
});
