import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PinoLogger } from 'nestjs-pino';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

import {
  USER_CONSTANTS,
  USER_ERROR_MESSAGES,
  USER_LOG_MESSAGES,
} from '../constants/user.constants';
import { type RegisterUserDto } from '../dto/register-user.dto';
import { UserRepository } from '../repositories/user.repository';
import { UserOtpService } from './user-otp.service';
import { MailerService } from '../../mailer/mailer.service';

@Injectable()
export class UserRegisterService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly otpService: UserOtpService,
    private readonly mailerService: MailerService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UserRegisterService.name);
  }

  async register(
    dto: RegisterUserDto,
  ): Promise<{ message: string; email: string }> {
    this.logger.info('Starting registration');

    const passwordHash = await argon2.hash(dto.password, {
      timeCost: USER_CONSTANTS.ARGON2_TIME_COST,
      memoryCost: USER_CONSTANTS.ARGON2_MEMORY_COST,
      parallelism: USER_CONSTANTS.ARGON2_PARALLELISM,
    });

    try {
      const user = await this.userRepository.create({
        email: dto.email,
        passwordHash,
        status: 'PENDING_VERIFICATION',
      });

      this.logger.info({ userId: user.id }, USER_LOG_MESSAGES.REGISTER_SUCCESS);

      // OTP and email are non-critical — degrade gracefully
      try {
        const otp = await this.otpService.generate(user.id, user.email);
        await this.sendVerificationEmail(user.email, otp);
      } catch (err: unknown) {
        this.logger.error(
          { err, userId: user.id },
          'OTP generation or email send failed — user can request resend',
        );
      }

      return {
        message:
          'Registration successful. Please check your email to verify your account.',
        email: user.email,
      };
    } catch (error: unknown) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Do not reveal that the email is already registered (enumeration).
        // Return the same generic response as a fresh registration; the owner
        // of an existing account keeps using their original credentials.
        this.logger.info(
          { email: dto.email },
          'Registration attempted for existing email',
        );

        return {
          message:
            'Registration successful. Please check your email to verify your account.',
          email: dto.email,
        };
      }

      this.logger.error({ err: error }, USER_ERROR_MESSAGES.REGISTER_FAILED);
      throw new InternalServerErrorException(
        USER_ERROR_MESSAGES.REGISTER_FAILED,
      );
    }
  }

  private async sendVerificationEmail(
    email: string,
    otp: string,
  ): Promise<void> {
    const expiryMinutes = USER_CONSTANTS.OTP_EXPIRY_SECONDS / 60;

    const html = `
      <h1>Verify your email</h1>
      <p>Your verification code is:</p>
      <h2>${otp}</h2>
      <p>This code expires in ${expiryMinutes} minutes.</p>
      <p>If you didn't create an account, you can safely ignore this email.</p>
    `;

    const text = [
      'Verify your email',
      '',
      `Your verification code is: ${otp}`,
      '',
      `This code expires in ${expiryMinutes} minutes.`,
      '',
      "If you didn't create an account, you can safely ignore this email.",
    ].join('\n');

    await this.mailerService.sendMail({
      to: email,
      subject: 'Verify your email address',
      html,
      text,
    });
  }
}
