import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { sendOTPEmail, sendVerificationEmail } from '../lib/email';
import type { RegisterInput, LoginInput } from '../schemas/auth.schema';

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m';
const REFRESH_EXPIRY_DAYS = 30;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateAccessToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRY } as jwt.SignOptions);
}

function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

export async function register(input: RegisterInput) {
  const existing = await prisma.usuario.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new Error('El email ya está registrado');
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const otp = generateOTP();
  const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min

  const usuario = await prisma.usuario.create({
    data: {
      nombre: input.nombre,
      email: input.email,
      celular: input.celular,
      passwordHash,
      otpCode: otp,
      otpExpires,
    },
    select: {
      id: true,
      nombre: true,
      email: true,
      celular: true,
      emailVerificado: true,
      fechaRegistro: true,
    },
  });

  // Send verification email (non-blocking)
  sendVerificationEmail(input.email, input.nombre, otp).catch((err) =>
    console.error('[Email] Failed to send verification:', err)
  );

  // Create tokens
  const accessToken = generateAccessToken(usuario.id, usuario.email);
  const refreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      usuarioId: usuario.id,
      token: refreshToken,
      fechaExpiracion: new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  return { usuario, accessToken, refreshToken };
}

export async function login(input: LoginInput) {
  const usuario = await prisma.usuario.findUnique({ where: { email: input.email } });

  if (!usuario || !usuario.activo) {
    throw new Error('Credenciales inválidas');
  }

  const passwordValid = await bcrypt.compare(input.password, usuario.passwordHash);
  if (!passwordValid) {
    throw new Error('Credenciales inválidas');
  }

  const accessToken = generateAccessToken(usuario.id, usuario.email);
  const refreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      usuarioId: usuario.id,
      token: refreshToken,
      fechaExpiracion: new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  const { passwordHash: _ph, otpCode: _otp, otpExpires: _otpExp, ...usuarioSafe } = usuario;
  return { usuario: usuarioSafe, accessToken, refreshToken };
}

export async function refresh(refreshToken: string) {
  const tokenRecord = await prisma.refreshToken.findFirst({
    where: {
      token: refreshToken,
      revocado: false,
      fechaExpiracion: { gt: new Date() },
    },
    include: { usuario: true },
  });

  if (!tokenRecord) {
    throw new Error('Refresh token inválido o expirado');
  }

  // Rotate: revoke old, issue new
  await prisma.refreshToken.update({
    where: { id: tokenRecord.id },
    data: { revocado: true },
  });

  const accessToken = generateAccessToken(tokenRecord.usuario.id, tokenRecord.usuario.email);
  const newRefreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      usuarioId: tokenRecord.usuario.id,
      token: newRefreshToken,
      fechaExpiracion: new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken, refreshToken: newRefreshToken };
}

export async function forgotPassword(email: string) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  // Don't reveal if email exists
  if (!usuario) return;

  const otp = generateOTP();
  const otpExpires = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { otpCode: otp, otpExpires },
  });

  sendOTPEmail(email, usuario.nombre, otp).catch((err) =>
    console.error('[Email] Failed to send OTP:', err)
  );
}

export async function resetPassword(email: string, otp: string, newPassword: string) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });

  if (
    !usuario ||
    usuario.otpCode !== otp ||
    !usuario.otpExpires ||
    usuario.otpExpires < new Date()
  ) {
    throw new Error('Código OTP inválido o expirado');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      passwordHash,
      otpCode: null,
      otpExpires: null,
      emailVerificado: true,
    },
  });

  // Revoke all refresh tokens for security
  await prisma.refreshToken.updateMany({
    where: { usuarioId: usuario.id, revocado: false },
    data: { revocado: true },
  });
}

export async function getMe(userId: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nombre: true,
      email: true,
      celular: true,
      fotoUrl: true,
      emailVerificado: true,
      fechaRegistro: true,
      expoPushToken: true,
    },
  });

  if (!usuario) throw new Error('Usuario no encontrado');
  return usuario;
}

export async function updatePushToken(userId: string, expoPushToken: string) {
  await prisma.usuario.update({
    where: { id: userId },
    data: { expoPushToken },
  });
}
