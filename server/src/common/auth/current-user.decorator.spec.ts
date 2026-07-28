import { CurrentUser } from './current-user.decorator';

describe('CurrentUser', () => {
  it('should be defined', () => {
    expect(CurrentUser).toBeDefined();
  });

  it('should be a function (decorator factory)', () => {
    expect(typeof CurrentUser).toBe('function');
  });
});
