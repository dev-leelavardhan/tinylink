import { registerUserSchema } from './register-user.dto';
import { USER_CONSTANTS } from '../constants/user.constants';

describe('registerUserSchema', () => {
  it('validates a valid registration', () => {
    const result = registerUserSchema.parse({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.email).toBe('test@example.com');
    expect(result.password).toBe('password123');
  });

  it('rejects invalid email', () => {
    expect(() =>
      registerUserSchema.parse({ email: 'invalid', password: 'password123' }),
    ).toThrow();
  });

  it('rejects password shorter than minimum', () => {
    expect(() =>
      registerUserSchema.parse({
        email: 'test@example.com',
        password: 'short',
      }),
    ).toThrow();
  });

  it('rejects password longer than maximum', () => {
    expect(() =>
      registerUserSchema.parse({
        email: 'test@example.com',
        password: 'a'.repeat(USER_CONSTANTS.MAX_PASSWORD_LENGTH + 1),
      }),
    ).toThrow();
  });
});
