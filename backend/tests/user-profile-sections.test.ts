import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/utils/logger.js', () => ({ logger: { warn: vi.fn() } }));

import { createUserProfileSectionRegistry } from '../src/modules/users/user-profile-section.registry.js';

describe('user profile section registry', () => {
  it('renders newly registered sections without changing the consumer', async () => {
    const registry = createUserProfileSectionRegistry([{
      key: 'existing', title: 'Mevcut Bölüm', fetch: async (userId) => [{ userId, value: 1 }],
    }]);
    registry.register({ key: 'future_module', title: 'Yeni Modül', fetch: async () => [{ enabled: true }] });

    await expect(registry.fetchAll('user-1')).resolves.toEqual([
      { key: 'existing', title: 'Mevcut Bölüm', data: [{ userId: 'user-1', value: 1 }] },
      { key: 'future_module', title: 'Yeni Modül', data: [{ enabled: true }] },
    ]);
  });

  it('skips a failing section without affecting successful sections', async () => {
    const registry = createUserProfileSectionRegistry([
      { key: 'failing', title: 'Hatalı', fetch: async () => { throw new Error('table unavailable'); } },
      { key: 'healthy', title: 'Sağlıklı', fetch: async () => ({ count: 2 }) },
    ]);

    await expect(registry.fetchAll('user-1')).resolves.toEqual([
      { key: 'healthy', title: 'Sağlıklı', data: { count: 2 } },
    ]);
  });

  it('rejects duplicate section keys', () => {
    const registry = createUserProfileSectionRegistry([{ key: 'same', title: 'İlk', fetch: async () => [] }]);
    expect(() => registry.register({ key: 'same', title: 'İkinci', fetch: async () => [] }))
      .toThrow('Duplicate user profile section: same');
  });
});
