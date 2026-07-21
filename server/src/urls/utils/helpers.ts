import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

export const isUniqueConstraintOn = (
  error: PrismaClientKnownRequestError,
  fields: string[],
): boolean => {
  const target = error.meta?.target;
  if (!Array.isArray(target)) {
    return false;
  }

  return (
    fields.length === target.length &&
    fields.every((field) => target.includes(field))
  );
};
