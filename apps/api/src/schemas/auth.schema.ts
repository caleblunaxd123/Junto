import { z } from 'zod';
import { validShareEmail } from '@junto/shared/share';
const correo = z.string().trim().toLowerCase().max(254, 'Usa un correo de hasta 254 caracteres.').email('Usa un correo como nombre@correo.com, sin espacios.').refine(validShareEmail, 'Usa un solo correo válido, sin espacios.');

const celularPeru = z
  .string()
  .regex(/^9\d{8}$/, 'El celular debe ser formato peruano: 9XXXXXXXX (9 dígitos, empieza en 9)');

export const registerSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  email: correo,
  celular: celularPeru.optional(),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/\d/, 'La contraseña debe contener al menos un número'),
});

export const loginSchema = z.object({
  email: correo,
  password: z.string().min(1, 'Contraseña requerida'),
});

export const forgotPasswordSchema = z.object({
  email: correo,
});

export const resetPasswordSchema = z.object({
  email: correo,
  otp: z.string().regex(/^\d{6}$/, 'Completa los 6 dígitos del código más reciente.'),
  newPassword: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/\d/, 'La contraseña debe contener al menos un número'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requerido'),
});

const expoPushToken = z.string().regex(/^Expo(nent)?PushToken\[.+\]$/, 'Token de notificaciones inválido').max(200);
export const logoutSchema = refreshTokenSchema.extend({ expoPushToken: expoPushToken.optional() });
export const updatePushTokenSchema = z.object({
  expoPushToken,
  // New clients bind registration to a live session; old clients remain compatible.
  refreshToken: z.string().min(1).max(500).optional(),
});

export const verifyEmailSchema = z.object({
  email: correo,
  otp: z.string().regex(/^\d{6}$/, 'El código debe tener 6 dígitos'),
});

export const resendVerificationSchema = z.object({
  email: correo,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
