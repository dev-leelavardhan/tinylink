import { CurrentUser } from './current-user.decorator';

describe('CurrentUser', () => {
  it('should be defined', () => {
    expect(CurrentUser).toBeDefined();
  });

  it('should be a function (decorator factory)', () => {
    expect(typeof CurrentUser).toBe('function');
  });

  it('should return a decorator when called without arguments', () => {
    const decorator = CurrentUser();
    expect(typeof decorator).toBe('function');
  });

  it('should return a decorator when called with a property key', () => {
    const decorator = CurrentUser('userId');
    expect(typeof decorator).toBe('function');
  });
});
