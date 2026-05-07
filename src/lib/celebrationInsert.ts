import type { createServerClient } from '@/lib/supabase';

/** Queue a sale celebration (+ optional daily milestone) on the live dashboard */
export async function insertCelebrationEvent(
  supabase: ReturnType<typeof createServerClient>,
  customerName: string,
  branch: string,
  amount: number,
  customerId: string,
  batchAmId?: string | null,
): Promise<void> {
  try {
    const { data: custRow } = await supabase
      .from('customers')
      .select('account_manager_id')
      .eq('id', customerId)
      .single();

    const resolvedAmId = batchAmId || custRow?.account_manager_id;

    let amPayload: Record<string, unknown> = {};
    if (resolvedAmId) {
      const { data: am } = await supabase
        .from('admin_users')
        .select('id, name, avatar_url, celebration_video_url, celebration_video_start, celebration_video_end')
        .eq('id', resolvedAmId)
        .single();
      if (am) {
        amPayload = {
          amId: am.id,
          amName: am.name,
          amAvatarUrl: am.avatar_url,
          celebrationVideoUrl: am.celebration_video_url,
          videoStart: am.celebration_video_start,
          videoEnd: am.celebration_video_end,
        };
      }
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
