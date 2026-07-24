import { UserMapper } from './user.mapper';

describe('UserMapper', () => {
  let mapper: UserMapper;

  beforeEach(() => {
    mapper = new UserMapper();
  });

  describe('toProfile', () => {
    it('should map user to profile response', () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        emailVerified: true,
        status: 'ACTIVE' as const,
        tokenVersion: 0,
        lastLoginAt: new Date('2024-01-01'),
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const result = mapper.toProfile(user);

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: true,
        status: 'ACTIVE',
        createdAt: new Date('2023-01-01'),
        lastLoginAt: new Date('2024-01-01'),
      });
    });

    it('should handle null lastLoginAt', () => {
      const user = {
        id: 'user-2',
        email: 'test2@example.com',
        passwordHash: 'hashed-password',
        emailVerified: false,
        status: 'PENDING_VERIFICATION' as const,
        tokenVersion: 0,
        lastLoginAt: null,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const result = mapper.toProfile(user);

      expect(result.lastLoginAt).toBeNull();
    });
  });
});
