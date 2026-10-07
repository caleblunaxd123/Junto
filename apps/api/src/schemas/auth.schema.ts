import { z } from 'zod';

const celularPeru = z
  .string()
  .regex(/^9\d{8}$/, 'El celular debe ser formato peruano: 9XXXXXXXX (9 dígitos, empieza en 9)');

export const registerSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  email: z.string().trim().toLowerCase().email('Email inválido'),
  celular: celularPeru.optional(),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/\d/, 'La contraseña debe contener al menos un número'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
  otp: z.string().regex(/^\d{6}$/, 'El código OTP debe tener 6 dígitos'),
  newPassword: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/\d/, 'La contraseña debe contener al menos un número'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requerido'),
});

export const updatePushTokenSchema = z.object({
  expoPushToken: z.string().min(1),
});

export const verifyEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
  otp: z.string().regex(/^\d{6}$/, 'El código debe tener 6 dígitos'),
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
