export const MAILER_CONSTANTS = {
  // SMTP defaults
  DEFAULT_PORT: 587,
  SECURE_PORT: 465,
  SECURE: false,

  // Email
  VERIFY_EMAIL_SUBJECT: 'Verify your email address',
  OTP_LENGTH: 6,
} as const;

export const MAILER_LOG_MESSAGES = {
  SEND_STARTED: 'Sending email',
  SEND_COMPLETED: 'Email sent successfully',
  SEND_FAILED: 'Failed to send email',
} as const;

export const MAILER_ERROR_MESSAGES = {
  SEND_FAILED: 'Failed to send email',
  INVALID_CONFIG: 'Mailer configuration is missing',
} as const;
