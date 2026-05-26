import { describe, expect, it } from 'vitest';
import { parseTeamleaderResponseText, TeamleaderApiError } from '@/lib/teamleader/client';

describe('parseTeamleaderResponseText', () => {
  it('returns null for empty body (204 No Content)', () => {
    expect(parseTeamleaderResponseText('', 204)).toBeNull();
    expect(parseTeamleaderResponseText('   ', 204)).toBeNull();
  });

  it('parses JSON-RPC success payload', () => {
    const json = parseTeamleaderResponseText<{ id: string }>(
      '{"data":{"id":"abc-123"}}',
      200,
    );
    expect(json?.data?.id).toBe('abc-123');
  });

  it('throws TeamleaderApiError on invalid JSON', () => {
    expect(() => parseTeamleaderResponseText('not-json', 500)).toThrow(TeamleaderApiError);
  });
});
