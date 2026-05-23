import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/teamleader/client', () => ({
  teamleaderRequest: vi.fn(),
}));

import { teamleaderRequest } from '@/lib/teamleader/client';
import { findContactByEmail } from '@/lib/teamleader/contacts';

describe('findContactByEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses nested email filter with type primary', async () => {
    vi.mocked(teamleaderRequest).mockResolvedValue([{ id: 'contact-1' }]);

    const id = await findContactByEmail('token', 'Jan@Test.NL');

    expect(id).toBe('contact-1');
    expect(teamleaderRequest).toHaveBeenCalledWith('token', 'contacts.list', {
      filter: {
        email: {
          type: 'primary',
          email: 'jan@test.nl',
        },
      },
      page: { size: 1, number: 1 },
    });
  });

  it('returns null for empty email', async () => {
    expect(await findContactByEmail('token', '   ')).toBeNull();
    expect(teamleaderRequest).not.toHaveBeenCalled();
  });
});
