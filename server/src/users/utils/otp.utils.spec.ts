import { generateOtp } from './otp.utils';

describe('generateOtp', () => {
  it('should generate OTP of specified length', () => {
    const otp = generateOtp(6);
    expect(otp).toHaveLength(6);
  });

  it('should contain only digits', () => {
    const otp = generateOtp(8);
    expect(/^\d+$/.test(otp)).toBe(true);
  });

  it('should generate different OTPs on each call', () => {
    const otp1 = generateOtp(6);
    const otp2 = generateOtp(6);
    // Statistically should be different (not guaranteed but very likely)
    expect(otp1).not.toBe(otp2);
  });
});
