import { z } from 'zod';

import { QR_CONSTANTS } from '../constants/qr.constants';

export const qrQuerySchema = z.object({
  format: z.enum(['png', 'svg']).default(QR_CONSTANTS.DEFAULT_FORMAT),
  size: z.coerce
    .number()
    .int()
    .min(QR_CONSTANTS.MIN_SIZE)
    .max(QR_CONSTANTS.MAX_SIZE)
    .default(QR_CONSTANTS.DEFAULT_SIZE),
});

export type QrQueryDto = z.infer<typeof qrQuerySchema>;
