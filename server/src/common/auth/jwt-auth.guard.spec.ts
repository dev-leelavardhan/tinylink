import { JwtAuthGuard, JwtAuthOptionalGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should have canActivate method', () => {
    expect(typeof guard.canActivate).toBe('function');
  });
});

describe('JwtAuthOptionalGuard', () => {
  let guard: JwtAuthOptionalGuard;

  beforeEach(() => {
    guard = new JwtAuthOptionalGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should have canActivate method', () => {
    expect(typeof guard.canActivate).toBe('function');
  });

  describe('handleRequest', () => {
    it('should return user if authenticated', () => {
      const user = { userId: 'user-1' };
      const result = guard.handleRequest(null, user);
      expect(result).toEqual(user);
    });

    it('should return null if error occurs', () => {
      const result = guard.handleRequest(new Error('Unauthorized'), null);
      expect(result).toBeNull();
    });

    it('should return null if no user', () => {
      const result = guard.handleRequest(null, null);
      expect(result).toBeNull();
    });
  });
});
