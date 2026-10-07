import { Request, Response, NextFunction } from "express";
import * as authService from "../services/auth.service";
import { z } from "zod";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  updatePushTokenSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from "../schemas/auth.schema";

export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshTokenSchema.parse(req.body);
    const result = await authService.refresh(refreshToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshTokenSchema.parse(req.body);
    await authService.logout(refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    await authService.forgotPassword(email);
    res.json({
      message:
        "Solicitud registrada. Si hay una cuenta activa con ese correo, enviaremos un código. Revisa también spam; si no llega, vuelve a solicitarlo en un minuto.",
    });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { email, otp, newPassword } = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(email, otp, newPassword);
    res.json({ message: "Contraseña actualizada correctamente" });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const usuario = await authService.getMe(req.user!.userId);
    res.json(usuario);
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = z
      .object({
        nombre: z.string().trim().min(2).max(100),
        celular: z
          .string()
          .regex(/^9\d{8}$/)
          .nullable()
          .optional(),
      })
      .parse(req.body);
    const { prisma } = await import("../lib/prisma");
    await prisma.usuario.update({
      where: { id: req.user!.userId },
      data: input,
    });
    res.json(await authService.getMe(req.user!.userId));
  } catch (error) {
    next(error);
  }
}

export async function updatePushToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { expoPushToken } = updatePushTokenSchema.parse(req.body);
    await authService.updatePushToken(req.user!.userId, expoPushToken);
    res.json({ message: "Token actualizado" });
  } catch (err) {
    next(err);
  }
}

export async function verifyEmail(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { email, otp } = verifyEmailSchema.parse(req.body);
    const result = await authService.verifyEmail(email, otp);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function resendVerification(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { email } = resendVerificationSchema.parse(req.body);
    await authService.resendVerification(email);
    res.json({
      message: "Si la cuenta está pendiente, enviaremos un nuevo código",
    });
  } catch (err) {
    next(err);
  }
}

export async function verificarCelulares(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { z } = await import("zod");
    const { celulares } = z
      .object({ celulares: z.array(z.string()).max(200) })
      .parse(req.body);
    const { prisma } = await import("../lib/prisma");
    const usuarios = await prisma.usuario.findMany({
      where: { celular: { in: celulares }, activo: true },
      select: { celular: true },
    });
    const registrados = usuarios
      .map((u) => u.celular)
      .filter(Boolean) as string[];
    res.json({ celulares_registrados: registrados });
  } catch (err) {
    next(err);
  }
}

export async function deletionSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const { deletionSummary } = await import("../services/account.service");
    res.json(await deletionSummary(req.user!.userId));
  } catch (err) {
    next(err);
  }
}

export async function deleteAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const { password } = z.object({ password: z.string().min(1, "Escribe tu contraseña").max(200) }).parse(req.body);
    const { deleteAccount } = await import("../services/account.service");
    await deleteAccount(req.user!.userId, password);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
