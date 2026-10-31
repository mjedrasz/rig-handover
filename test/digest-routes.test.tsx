import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });

let runsDir: string;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  mkdirSync(runsDir, { recursive: true });
  const good = [
    line('2026-10-28T02:00:00+01:00', 'zeta-sync', 'ok', 'ana'),
    line('2026-10-28T02:05:00+01:00', 'alpha-backup', 'retry', null, 'timeout'),
    line('2026-10-28T02:10:00+01:00', 'alpha-backup', 'ok', null),
    line('2026-10-28T02:15:00+01:00', 'mid-report', 'fail', 'bo', 'boom'),
  ];
  writeFileSync(join(runsDir, '2026-10-01.jsonl'), good.join('\n') + '\n');
  writeFileSync(join(runsDir, '2026-10-02.jsonl'), '');
  writeFileSync(join(runsDir, '2026-10-03.jsonl'), [good[0], '{not json', good[3]].join('\n') + '\n');
});

afterAll(() => rmSync(runsDir, { recursive: true, force: true }));

const app = () =>
  createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });

const getNight = async (night: string) => (await app().request(`/api/digest/${night}`)).json() as Promise<Night>;

describe('GET /digest/:night', () => {
  it('renders rows sorted by job with the lane banner', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await app().request('/digest/2026-10-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('<table');
    const at = ['alpha-backup', 'mid-report', 'zeta-sync'].map((j) => html.indexOf(j));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it('shows a null owner as an em dash', async () => {
    const html = await (await app().request('/digest/2026-10-01')).text();
    expect(html).toContain('—');
  });

  it('404s when the night has no file', async () => {
    expect((await app().request('/digest/2026-10-09')).status).toBe(404);
  });

  it('says nothing ran for an empty file', async () => {
    const res = await app().request('/digest/2026-10-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders a night with a bad line', async () => {
    const res = await app().request('/digest/2026-10-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('mid-report');
    expect(html).toContain('zeta-sync');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns night, rows and badLines', async () => {
    const res = await app().request('/api/digest/2026-10-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.night).toBe('2026-10-01');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha-backup', 'mid-report', 'zeta-sync']);
    expect(body.rows[0]?.owner).toBeNull();
  });

  it('404s when the night has no file', async () => {
    expect((await app().request('/api/digest/2026-10-09')).status).toBe(404);
  });

  it('gives no rows and no bad lines for an empty file', async () => {
    const res = await app().request('/api/digest/2026-10-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-10-02', rows: [], badLines: 0 });
  });

  it('counts a bad line and keeps the other rows', async () => {
    const body = await getNight('2026-10-03');
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['mid-report', 'zeta-sync']);
  });
});

describe('page and JSON agree', () => {
  it('lists the same jobs in the same order', async () => {
    const html = await (await app().request('/digest/2026-10-01')).text();
    const { rows } = await getNight('2026-10-01');
    const order = rows.map((r) => html.indexOf(r.job));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});
