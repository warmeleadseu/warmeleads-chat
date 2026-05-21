import type { createServerClient } from '@/lib/supabase';

type Supabase = ReturnType<typeof createServerClient>;

interface CelebrationVideoDefaults {
  url: string | null;
  start: number | null;
  end: number | null;
}

/**
 * Haal de centrale fallback-celebration-video op (app_settings).
 *
 * Wordt gebruikt zodat ELKE sale op het live dashboard een feestvideo
 * krijgt — ook van AMs die zelf nog geen `celebration_video_url` in hun
 * profiel hebben ingevuld. Migration 121 zet hier een werkende default.
 */
async function loadCelebrationVideoDefaults(supabase: Supabase): Promise<CelebrationVideoDefaults> {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', [
        'default_celebration_video_url',
        'default_celebration_video_start',
        'default_celebration_video_end',
      ]);

    const map = new Map<string, string>();
    for (const row of data || []) {
      if (row && typeof row.key === 'string' && typeof row.value === 'string') {
        map.set(row.key, row.value);
      }
    }

    const url = map.get('default_celebration_video_url')?.trim() || null;
    const startRaw = map.get('default_celebration_video_start');
    const endRaw = map.get('default_celebration_video_end');
    const start = startRaw && /^\d+$/.test(startRaw) ? Number(startRaw) : null;
    const end = endRaw && /^\d+$/.test(endRaw) ? Number(endRaw) : null;

    return { url, start, end };
  } catch {
    return { url: null, start: null, end: null };
  }
}

/** Queue a sale celebration (+ optional daily milestone) on the live dashboard */
export async function insertCelebrationEvent(
  supabase: Supabase,
  customerName: string,
  branch: string,
  amount: number,
  customerId: string,
  batchAmId?: string | null,
): Promise<void> {
  try {
    const [{ data: custRow }, defaults] = await Promise.all([
      supabase
        .from('customers')
        .select('account_manager_id')
        .eq('id', customerId)
        .single(),
      loadCelebrationVideoDefaults(supabase),
    ]);

    const resolvedAmId = batchAmId || custRow?.account_manager_id;

    let amPayload: Record<string, unknown> = {};
    if (resolvedAmId) {
      const { data: am } = await supabase
        .from('admin_users')
        .select('id, name, avatar_url, celebration_video_url, celebration_video_start, celebration_video_end')
        .eq('id', resolvedAmId)
        .single();
      if (am) {
        // Eigen URL > fallback. start/end alleen overnemen van de bron die
        // ook de URL levert (anders krijg je AM-URL met fallback-end-time).
        const hasOwnUrl = !!am.celebration_video_url;
        const videoUrl = hasOwnUrl ? am.celebration_video_url : defaults.url;
        const videoStart = hasOwnUrl ? am.celebration_video_start : defaults.start;
        const videoEnd = hasOwnUrl ? am.celebration_video_end : defaults.end;

        amPayload = {
          amId: am.id,
          amName: am.name,
          amAvatarUrl: am.avatar_url,
          celebrationVideoUrl: videoUrl,
          videoStart,
          videoEnd,
          videoIsFallback: !hasOwnUrl && !!defaults.url,
        };
      }
    } else if (defaults.url) {
      // Geen AM gekoppeld? Toon toch een feestvideo — laadbudget-/handmatige
      // verkopen verdienen ook een viering op het live dashboard.
      amPayload = {
        celebrationVideoUrl: defaults.url,
        videoStart: defaults.start,
        videoEnd: defaults.end,
        videoIsFallback: true,
      };
    }

    await supabase.from('celebration_events').insert({
      event_type: 'sale',
      payload: { customer: customerName, branch, amount, ...amPayload },
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('celebration_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'sale')
      .gte('created_at', todayStart.toISOString());

    const milestoneNumbers = [3, 5, 10, 15, 20, 25, 50, 100];
    if (count && milestoneNumbers.includes(count)) {
      await supabase.from('celebration_events').insert({
        event_type: 'milestone',
        payload: { milestoneText: `${count}e sale vandaag!`, count },
      });
    }
  } catch (e) {
    console.error('[celebrationInsert] celebration event insert failed:', e);
  }
}
