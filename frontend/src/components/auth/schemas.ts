import { z } from 'zod';

// Mirrors backend/app/schemas/auth.py so users see the same rules before submitting.
export const emailField = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .pipe(z.email('Enter a valid email address.'));

export const newPasswordField = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use at most 72 characters.')
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/\d/, 'Include at least one number.');

export const otpField = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code.');

export const PASSWORD_HINT =
  'At least 8 characters, with a letter and a number.';
