import { changePasswordSchema } from './change-password.dto';
import { USER_CONSTANTS } from '../constants/user.constants';

describe('changePasswordSchema', () => {
  it('validates a valid password change', () => {
    const result = changePasswordSchema.parse({
      currentPassword: 'OldPassword1!',
      newPassword: 'NewPassword2@',
    });
    expect(result.currentPassword).toBe('OldPassword1!');
    expect(result.newPassword).toBe('NewPassword2@');
  });

  it('rejects empty current password', () => {
    expect(() =>
      changePasswordSchema.parse({
        currentPassword: '',
        newPassword: 'NewPassword2@',
      }),
    ).toThrow();
  });

  it('rejects new password shorter than minimum', () => {
    expect(() =>
      changePasswordSchema.parse({
        currentPassword: 'OldPassword1!',
        newPassword: 'A1!a',
      }),
    ).toThrow();
  });

  it('rejects new password longer than maximum', () => {
    expect(() =>
      changePasswordSchema.parse({
        currentPassword: 'OldPassword1!',
        newPassword: 'A'.repeat(USER_CONSTANTS.MAX_PASSWORD_LENGTH) + '1!a',
      }),
    ).toThrow();
  });

  it('rejects new password without uppercase', () => {
    expect(() =>
      changePasswordSchema.parse({
        currentPassword: 'OldPassword1!',
        newPassword: 'newpassword1!',
      }),
    ).toThrow();
  });

  it('rejects new password without lowercase', () => {
    expect(() =>
      changePasswordSchema.parse({
        currentPassword: 'OldPassword1!',
        newPassword: 'NEWPASSWORD1!',
      }),
    ).toThrow();
  });

  it('rejects new password without number', () => {
    expect(() =>
      changePasswordSchema.parse({
        currentPassword: 'OldPassword1!',
        newPassword: 'NewPassword!',
      }),
    ).toThrow();
  });

  it('rejects new password without special character', () => {
    expect(() =>
      changePasswordSchema.parse({
        currentPassword: 'OldPassword1!',
        newPassword: 'NewPassword1',
      }),
    ).toThrow();
  });
});
