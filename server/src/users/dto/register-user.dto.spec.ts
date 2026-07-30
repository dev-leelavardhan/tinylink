import { registerUserSchema } from './register-user.dto';
import { USER_CONSTANTS } from '../constants/user.constants';

describe('registerUserSchema', () => {
  it('validates a valid registration', () => {
    const result = registerUserSchema.parse({
      email: 'test@example.com',
      password: 'Password1!',
    });
    expect(result.email).toBe('test@example.com');
    expect(result.password).toBe('Password1!');
  });

  it('normalizes email to lowercase and trims', () => {
    const result = registerUserSchema.parse({
      email: '  Test@Example.COM  ',
      password: 'Password1!',
    });
    expect(result.email).toBe('test@example.com');
  });

  it('rejects invalid email', () => {
    expect(() =>
      registerUserSchema.parse({ email: 'invalid', password: 'Password1!' }),
    ).toThrow();
  });

  it('rejects password shorter than minimum', () => {
    expect(() =>
      registerUserSchema.parse({
        email: 'test@example.com',
        password: 'A1!a',
      }),
    ).toThrow();
  });

  it('rejects password longer than maximum', () => {
    expect(() =>
      registerUserSchema.parse({
        email: 'test@example.com',
        password: 'A'.repeat(USER_CONSTANTS.MAX_PASSWORD_LENGTH) + '1!a',
      }),
    ).toThrow();
  });

  it('rejects password without uppercase', () => {
    expect(() =>
      registerUserSchema.parse({
        email: 'test@example.com',
        password: 'password1!',
      }),
    ).toThrow();
  });

  it('rejects password without lowercase', () => {
    expect(() =>
      registerUserSchema.parse({
        email: 'test@example.com',
        password: 'PASSWORD1!',
      }),
    ).toThrow();
  });

  it('rejects password without number', () => {
    expect(() =>
      registerUserSchema.parse({
        email: 'test@example.com',
        password: 'Password!',
      }),
    ).toThrow();
  });

  it('rejects password without special character', () => {
    expect(() =>
      registerUserSchema.parse({
        email: 'test@example.com',
        password: 'Password1',
      }),
    ).toThrow();
  });
});
