import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import {
  sendOTPEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} from "../lib/email";
import type { RegisterInput, LoginInput } from "../schemas/auth.schema";
import { UserError } from "../domain/errors";
import { credentialsTag } from "../domain/credentials";

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRY = process.env.JWT_EXPIRY || "15m";
const REFRESH_EXPIRY_DAYS = 30;

function generateOTP(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function generateAccessToken(
  userId: string,
  email: string,
  passwordHash: string,
): string {
  return jwt.sign(
    { userId, email, credentialsTag: credentialsTag(passwordHash, JWT_SECRET) },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY } as jwt.SignOptions,
  );
}

function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function register(input: RegisterInput) {
  const existing = await prisma.usuario.findUnique({
    where: { email: input.email },
  });
  if (existing) {
    throw new UserError(
      "Este correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña.",
    );
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
      otpPurpose: "verification",
      otpAttempts: 0,
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

  const emailDelivery = await sendVerificationEmail(
    input.email,
    input.nombre,
    otp,
  )
    .then(() => true)
    .catch(() => {
      console.error(
        "[Email] Verification delivery failed; account remains unverified.",
      );
      return false;
    });
  return { usuario, verificationRequired: true, emailDelivery };
}

export async function login(input: LoginInput) {
  const usuario = await prisma.usuario.findUnique({
    where: { email: input.email },
  });

  if (!usuario || !usuario.activo) {
    throw new UserError("El correo o la contraseña no coinciden.", 401);
  }

  const passwordValid = await bcrypt.compare(
    input.password,
    usuario.passwordHash,
  );
  if (!passwordValid) {
    throw new UserError("El correo o la contraseña no coinciden.", 401);
  }

  if (!usuario.emailVerificado) {
    throw new UserError(
      "Verifica tu correo antes de entrar.",
      403,
      "EMAIL_NO_VERIFICADO",
    );
  }

  const {
    passwordHash: _ph,
    otpCode: _otp,
    otpExpires: _otpExp,
    otpPurpose: _purpose,
    otpAttempts: _attempts,
    ...usuarioSafe
  } = usuario;
  return { usuario: usuarioSafe, ...(await issueSession(usuario)) };
}

async function issueSession(usuario: {
  id: string;
  email: string;
  passwordHash: string;
}) {
  const accessToken = generateAccessToken(
    usuario.id,
    usuario.email,
    usuario.passwordHash,
  );
  const refreshToken = generateRefreshToken();
  await prisma.$transaction(async (tx) => {
    // Serialize issuance with password reset (which updates this same row).
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${usuario.id}::uuid FOR UPDATE`;
    const current = await tx.usuario.findUnique({ where: { id: usuario.id } });
    if (
      !current?.activo ||
      !current.emailVerificado ||
      current.passwordHash !== usuario.passwordHash
    )
      throw new UserError("La cuenta cambió. Inicia sesión nuevamente.", 401);
    await tx.refreshToken.create({
      data: {
        usuarioId: usuario.id,
        token: hashRefreshToken(refreshToken),
        fechaExpiracion: new Date(
          Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
        ),
      },
    });
  });
  return { accessToken, refreshToken };
}

export async function verifyEmail(email: string, otp: string) {
  const usuario = await validateCode(email, otp, "verification");
  const consumed = await prisma.usuario.updateMany({
    where: {
      id: usuario.id,
      activo: true,
      otpCode: otp,
      otpPurpose: "verification",
      otpExpires: { gt: new Date() },
      otpAttempts: { lt: 5 },
    },
    data: {
      emailVerificado: true,
      otpCode: null,
      otpExpires: null,
      otpPurpose: null,
      otpAttempts: 0,
    },
  });
  if (consumed.count !== 1)
    throw new UserError(
      "Este código ya fue usado o expiró. Inicia sesión o solicita uno nuevo.",
    );
  const verified = await prisma.usuario.findUniqueOrThrow({
    where: { id: usuario.id },
    select: {
      id: true,
      nombre: true,
      email: true,
      celular: true,
      fotoUrl: true,
      emailVerificado: true,
      fechaRegistro: true,
    },
  });
  sendWelcomeEmail(verified.email, verified.nombre).catch((err) =>
    console.error("[Email] Failed to send welcome:", err),
  );
  return { usuario: verified, ...(await issueSession(usuario)) };
}

export async function resendVerification(email: string) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || usuario.emailVerificado) return;
  if (
    usuario.otpExpires &&
    usuario.otpExpires.getTime() - 14 * 60 * 1000 > Date.now()
  ) {
    throw new UserError("Espera un minuto antes de solicitar otro código");
  }
  const otp = generateOTP();
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      otpCode: otp,
      otpExpires: new Date(Date.now() + 15 * 60 * 1000),
      otpPurpose: "verification",
      otpAttempts: 0,
    },
  });
  try {
    await sendVerificationEmail(email, usuario.nombre, otp);
  } catch {
    throw new UserError(
      "No pudimos enviar el correo. Tu cuenta sigue protegida. Intenta reenviar en un minuto o contacta con soporte.",
      503,
      "EMAIL_DELIVERY_FAILED",
    );
  }
}

export async function refresh(refreshToken: string) {
  const tokenRecord = await prisma.refreshToken.findFirst({
    where: {
      token: hashRefreshToken(refreshToken),
      revocado: false,
      fechaExpiracion: { gt: new Date() },
    },
    include: { usuario: true },
  });

  if (
    !tokenRecord ||
    !tokenRecord.usuario.activo ||
    !tokenRecord.usuario.emailVerificado
  ) {
    throw new UserError("Tu sesión expiró. Inicia sesión nuevamente.", 401);
  }

  const accessToken = generateAccessToken(
    tokenRecord.usuario.id,
    tokenRecord.usuario.email,
    tokenRecord.usuario.passwordHash,
  );
  const newRefreshToken = generateRefreshToken();

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${tokenRecord.usuario.id}::uuid FOR UPDATE`;
    const current = await tx.usuario.findUnique({
      where: { id: tokenRecord.usuario.id },
    });
    if (
      !current?.activo ||
      !current.emailVerificado ||
      current.passwordHash !== tokenRecord.usuario.passwordHash
    )
      throw new UserError(
        "Tu contraseña cambió. Inicia sesión nuevamente.",
        401,
      );
    const rotated = await tx.refreshToken.updateMany({
      where: {
        id: tokenRecord.id,
        revocado: false,
        fechaExpiracion: { gt: new Date() },
      },
      data: { revocado: true },
    });
    if (rotated.count !== 1)
      throw new UserError("Tu sesión expiró. Inicia sesión nuevamente.", 401);
    await tx.refreshToken.create({
      data: {
        usuarioId: tokenRecord.usuario.id,
        token: hashRefreshToken(newRefreshToken),
        fechaExpiracion: new Date(
          Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
        ),
      },
    });
  });
  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(refreshToken: string) {
  await prisma.refreshToken.updateMany({
    where: { token: hashRefreshToken(refreshToken), revocado: false },
    data: { revocado: true },
  });
}

export async function forgotPassword(email: string) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  // Don't reveal if email exists
  if (!usuario || !usuario.activo) return;
  if (
    usuario.otpExpires &&
    usuario.otpExpires.getTime() - 14 * 60_000 > Date.now()
  )
    return;

  const otp = generateOTP();
  const otpExpires = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { otpCode: otp, otpExpires, otpPurpose: "reset", otpAttempts: 0 },
  });

  sendOTPEmail(email, usuario.nombre, otp).catch((err) =>
    console.error("[Email] Failed to send OTP:", err),
  );
}

export async function resetPassword(
  email: string,
  otp: string,
  newPassword: string,
) {
  const usuario = await validateCode(email, otp, "reset");

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction(async (tx) => {
    const consumed = await tx.usuario.updateMany({
      where: {
        id: usuario.id,
        activo: true,
        otpCode: otp,
        otpPurpose: "reset",
        otpExpires: { gt: new Date() },
        otpAttempts: { lt: 5 },
      },
      data: {
        passwordHash,
        otpCode: null,
        otpExpires: null,
        otpPurpose: null,
        otpAttempts: 0,
        emailVerificado: true,
      },
    });
    if (consumed.count !== 1)
      throw new UserError(
        "Este código ya fue usado o expiró. Solicita uno nuevo.",
      );

    // Revoke all refresh tokens for security
    await tx.refreshToken.updateMany({
      where: { usuarioId: usuario.id, revocado: false },
      data: { revocado: true },
    });
  });
}

async function validateCode(email: string, otp: string, purpose: string) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (
    !usuario ||
    !usuario.activo ||
    usuario.otpPurpose !== purpose ||
    !usuario.otpExpires ||
    usuario.otpExpires < new Date() ||
    usuario.otpAttempts >= 5
  )
    throw new UserError("Código incorrecto o expirado. Solicita uno nuevo.");
  if (usuario.otpCode !== otp) {
    await prisma.usuario.updateMany({
      where: {
        id: usuario.id,
        otpPurpose: purpose,
        otpCode: usuario.otpCode,
        otpAttempts: { lt: 5 },
      },
      data: { otpAttempts: { increment: 1 } },
    });
    throw new UserError(
      "Código incorrecto. Revisa los 6 dígitos e inténtalo de nuevo.",
    );
  }
  return usuario;
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

  if (!usuario) throw new Error("Usuario no encontrado");
  return usuario;
}

export async function updatePushToken(userId: string, expoPushToken: string) {
  await prisma.usuario.update({
    where: { id: userId },
    data: { expoPushToken },
  });
}
