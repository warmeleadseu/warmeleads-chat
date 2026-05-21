import { describe, it, expect, vi, beforeEach } from 'vitest';
import { insertCelebrationEvent } from '../celebrationInsert';

/**
 * Tests voor de celebration-fallback logica:
 *
 * Iedere paid batch moet een feestvideo op het live dashboard krijgen,
 * óók als de gekoppelde accountmanager geen `celebration_video_url` op
 * z'n profiel heeft staan. Sinds migration 121 lezen we daarvoor de
 * defaults uit `app_settings`.
 */

interface Row {
  table: string;
  payload: Record<string, unknown>;
}

function makeFakeSupabase(opts: {
  customer?: { account_manager_id?: string | null } | null;
  am?: {
    id: string;
    name: string;
    avatar_url: string | null;
    celebration_video_url: string | null;
    celebration_video_start: number | null;
    celebration_video_end: number | null;
  } | null;
  defaults?: { url?: string; start?: string; end?: string };
}) {
  const inserts: Row[] = [];
  const sb = {
    from(table: string) {
      if (table === 'celebration_events') {
        return {
          insert: async (payload: Record<string, unknown>) => {
            inserts.push({ table, payload });
            return { error: null };
          },
          select() {
            return {
              eq() { return { gte() { return Promise.resolve({ count: 1, data: [], error: null }); } }; },
            };
          },
        };
      }
      if (table === 'customers') {
        return {
          select() {
            return {
              eq() {
                return {
                  single: async () => ({ data: opts.customer ?? null, error: null }),
                };
              },
            };
          },
        };
      }
      if (table === 'admin_users') {
        return {
          select() {
            return {
              eq() {
                return {
                  single: async () => ({ data: opts.am ?? null, error: null }),
                };
              },
            };
          },
        };
      }
      if (table === 'app_settings') {
        return {
          select() {
            return {
              in: async () => {
                const data: Array<{ key: string; value: string }> = [];
                if (opts.defaults?.url !== undefined) data.push({ key: 'default_celebration_video_url', value: opts.defaults.url });
                if (opts.defaults?.start !== undefined) data.push({ key: 'default_celebration_video_start', value: opts.defaults.start });
                if (opts.defaults?.end !== undefined) data.push({ key: 'default_celebration_video_end', value: opts.defaults.end });
                return { data, error: null };
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
  return { sb: sb as unknown as Parameters<typeof insertCelebrationEvent>[0], inserts };
}

describe('insertCelebrationEvent · fallback video logica', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('gebruikt de eigen video van de AM wanneer die er is (geen fallback)', async () => {
    const { sb, inserts } = makeFakeSupabase({
      customer: { account_manager_id: 'am-1' },
      am: {
        id: 'am-1',
        name: 'Bart',
        avatar_url: null,
        celebration_video_url: 'https://youtu.be/own-video?si=x',
        celebration_video_start: 0,
        celebration_video_end: 12,
      },
      defaults: { url: 'https://youtu.be/fallback', start: '0', end: '15' },
    });

    await insertCelebrationEvent(sb, 'Klant X', 'thuisbatterij', 1200, 'cust-1');

    expect(inserts.length).toBeGreaterThanOrEqual(1);
    const saleRow = inserts.find(r => (r.payload as { event_type?: string }).event_type === 'sale');
    expect(saleRow).toBeDefined();
    const payload = (saleRow!.payload as { payload: Record<string, unknown> }).payload;
    expect(payload.celebrationVideoUrl).toBe('https://youtu.be/own-video?si=x');
    expect(payload.videoStart).toBe(0);
    expect(payload.videoEnd).toBe(12);
    expect(payload.videoIsFallback).toBe(false);
    expect(payload.amName).toBe('Bart');
  });

  it('valt terug op de app_settings-default wanneer de AM geen eigen URL heeft', async () => {
    const { sb, inserts } = makeFakeSupabase({
      customer: { account_manager_id: 'am-luigi' },
      am: {
        id: 'am-luigi',
        name: 'Luigi',
        avatar_url: null,
        celebration_video_url: null,
        celebration_video_start: 0,
        celebration_video_end: null,
      },
      defaults: { url: 'https://youtu.be/Aq5WXmQQooo', start: '0', end: '15' },
    });

    await insertCelebrationEvent(sb, 'Klant Y', 'airco', 800, 'cust-2');

    const saleRow = inserts.find(r => (r.payload as { event_type?: string }).event_type === 'sale');
    const payload = (saleRow!.payload as { payload: Record<string, unknown> }).payload;
    expect(payload.celebrationVideoUrl).toBe('https://youtu.be/Aq5WXmQQooo');
    expect(payload.videoStart).toBe(0);
    expect(payload.videoEnd).toBe(15);
    expect(payload.videoIsFallback).toBe(true);
    expect(payload.amName).toBe('Luigi');
  });

  it('mengt eigen start/end NIET met fallback wanneer beide kanten data hebben', async () => {
    // Edge-case: AM heeft start=5 en end=20 maar geen URL. We mogen die
    // tijden NIET combineren met de fallback-URL want de tijden horen
    // bij de eigen (afwezige) video, niet bij de fallback.
    const { sb, inserts } = makeFakeSupabase({
      customer: { account_manager_id: 'am-x' },
      am: {
        id: 'am-x',
        name: 'X',
        avatar_url: null,
        celebration_video_url: null,
        celebration_video_start: 5,
        celebration_video_end: 20,
      },
      defaults: { url: 'https://youtu.be/fallback', start: '0', end: '15' },
    });

    await insertCelebrationEvent(sb, 'Klant Z', 'thuisbatterij', 500, 'cust-3');

    const saleRow = inserts.find(r => (r.payload as { event_type?: string }).event_type === 'sale');
    const payload = (saleRow!.payload as { payload: Record<string, unknown> }).payload;
    expect(payload.celebrationVideoUrl).toBe('https://youtu.be/fallback');
    expect(payload.videoStart).toBe(0); // fallback-tijden, niet 5
    expect(payload.videoEnd).toBe(15); // fallback-tijden, niet 20
  });

  it('gebruikt de fallback óók wanneer er helemaal geen AM gekoppeld is', async () => {
    const { sb, inserts } = makeFakeSupabase({
      customer: { account_manager_id: null },
      am: null,
      defaults: { url: 'https://youtu.be/fallback-only', start: '0', end: '10' },
    });

    await insertCelebrationEvent(sb, 'Geen-AM', 'thuisbatterij', 300, 'cust-4');

    const saleRow = inserts.find(r => (r.payload as { event_type?: string }).event_type === 'sale');
    const payload = (saleRow!.payload as { payload: Record<string, unknown> }).payload;
    expect(payload.celebrationVideoUrl).toBe('https://youtu.be/fallback-only');
    expect(payload.videoIsFallback).toBe(true);
    expect(payload.amName).toBeUndefined();
  });

  it('laat celebrationVideoUrl ongezet wanneer ER GEEN default én GEEN eigen URL is', async () => {
    const { sb, inserts } = makeFakeSupabase({
      customer: { account_manager_id: 'am-y' },
      am: {
        id: 'am-y',
        name: 'Y',
        avatar_url: null,
        celebration_video_url: null,
        celebration_video_start: null,
        celebration_video_end: null,
      },
      defaults: {}, // geen rijen in app_settings
    });

    await insertCelebrationEvent(sb, 'Klant Q', 'thuisbatterij', 100, 'cust-5');

    const saleRow = inserts.find(r => (r.payload as { event_type?: string }).event_type === 'sale');
    const payload = (saleRow!.payload as { payload: Record<string, unknown> }).payload;
    expect(payload.celebrationVideoUrl).toBeNull();
    expect(payload.videoIsFallback).toBe(false);
  });

  it('behandelt niet-numerieke start/end strings als null (defensief)', async () => {
    const { sb, inserts } = makeFakeSupabase({
      customer: { account_manager_id: 'am-z' },
      am: {
        id: 'am-z',
        name: 'Z',
        avatar_url: null,
        celebration_video_url: null,
        celebration_video_start: null,
        celebration_video_end: null,
      },
      defaults: { url: 'https://youtu.be/fb', start: 'abc', end: 'xyz' },
    });

    await insertCelebrationEvent(sb, 'Klant', 'thuisbatterij', 0, 'cust-6');

    const saleRow = inserts.find(r => (r.payload as { event_type?: string }).event_type === 'sale');
    const payload = (saleRow!.payload as { payload: Record<string, unknown> }).payload;
    expect(payload.celebrationVideoUrl).toBe('https://youtu.be/fb');
    expect(payload.videoStart).toBeNull();
    expect(payload.videoEnd).toBeNull();
  });
});
