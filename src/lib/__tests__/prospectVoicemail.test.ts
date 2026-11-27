import { describe, expect, it } from 'vitest';
import { isVoicemail, pastBijVoicemailFilter, vatVoicemailsSamen, type VoicemailActiviteit } from '../prospectVoicemail';

const act = (prospect_id: string, type: string, metadata: Record<string, unknown>, created_at: string, admin_user_id = 'luigi'): VoicemailActiviteit =>
  ({ prospect_id, type, metadata, created_at, admin_user_id });

describe('voicemailteller', () => {
  it('telt de knop en oude statuswijzigingen naar Voicemail, niet dubbel', () => {
    expect(isVoicemail(act('a', 'call', { uitkomst: 'voicemail' }, 'x'))).toBe(true);
    expect(isVoicemail(act('a', 'status_change', { from: 'nieuw', to: 'voicemail' }, 'x'))).toBe(true);
    /* De statuswijziging die de knop zelf doet, telt niet nog eens. */
    expect(isVoicemail(act('a', 'status_change', { from: 'nieuw', to: 'voicemail', via_voicemail_knop: true }, 'x'))).toBe(false);
    expect(isVoicemail(act('a', 'call', {}, 'x'))).toBe(false);
    expect(isVoicemail(act('a', 'status_change', { to: 'contact' }, 'x'))).toBe(false);
    expect(isVoicemail(act('a', 'note', { uitkomst: 'voicemail' }, 'x'))).toBe(false);
  });

  it('per prospect het aantal en de momenten, nieuwste eerst, met naam', () => {
    const s = vatVoicemailsSamen([
      act('a', 'status_change', { to: 'voicemail' }, '2026-11-20T09:00:00Z'),
      act('a', 'call', { uitkomst: 'voicemail' }, '2026-11-26T13:30:00Z'),
      act('a', 'status_change', { to: 'voicemail', via_voicemail_knop: true }, '2026-11-26T13:30:00Z'),
      act('b', 'call', { uitkomst: 'voicemail' }, '2026-11-25T10:00:00Z', 'don'),
    ], id => (id === 'luigi' ? 'Luigi Pani' : null));
    expect(s.get('a')).toEqual({ aantal: 2, momenten: [{ op: '2026-11-26T13:30:00Z', door: 'Luigi Pani' }, { op: '2026-11-20T09:00:00Z', door: 'Luigi Pani' }] });
    expect(s.get('b')).toEqual({ aantal: 1, momenten: [{ op: '2026-11-25T10:00:00Z', door: null }] });
  });

  it('filter 1×, 2× en 3× of vaker', () => {
    expect([1, 2, 3, 5].map(n => pastBijVoicemailFilter(n, '1'))).toEqual([true, false, false, false]);
    expect([1, 2, 3].map(n => pastBijVoicemailFilter(n, '2'))).toEqual([false, true, false]);
    expect([2, 3, 7].map(n => pastBijVoicemailFilter(n, '3plus'))).toEqual([false, true, true]);
  });
});
