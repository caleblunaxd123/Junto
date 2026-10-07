import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { credentialsTag } from "../domain/credentials";

export interface AuthPayload {
  userId: string;
  email: string;
  credentialsTag: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token no proporcionado" });
    return;
  }

  const token = authHeader.substring(7);
  let payload: AuthPayload;
  try {
    payload = jwt.verify(
      token,
      process.env.JWT_SECRET as string,
    ) as AuthPayload;
    if (!payload || typeof payload.userId !== "string")
      throw new Error("Invalid claims");
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
    return;
  }
  try {
    const user = await prisma.usuario.findUnique({
      where: { id: payload.userId },
      select: { activo: true, emailVerificado: true, passwordHash: true },
    });
    if (
      !user?.activo ||
      !user.emailVerificado ||
      payload.credentialsTag !==
        credentialsTag(user.passwordHash, process.env.JWT_SECRET as string)
    ) {
      res
        .status(401)
        .json({
          error:
            "Tu sesión expiró o la contraseña cambió. Inicia sesión nuevamente.",
        });
      return;
    }
    req.user = payload;
    next();
  } catch (error) {
    next(error);
  }
}
