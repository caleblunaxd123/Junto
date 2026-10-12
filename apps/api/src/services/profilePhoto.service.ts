import { prisma } from "../lib/prisma";
import { UserError } from "../domain/errors";
import { decodeImage } from "./ocr.service";

/** The app sends a square JPEG of about 512 px; this leaves room for a PNG from the web. */
export const PROFILE_PHOTO_MAX_BYTES = 1024 * 1024;
const CHANGES_PER_HOUR = 10;
const recentChanges = new Map<string, number[]>();

/** Path stored in usuarios.foto_url; the app prefixes its API host. */
export const profilePhotoPath = (id: string) => `/api/fotos/${id}`;

function throttle(userId: string, now = Date.now()) {
  const times = (recentChanges.get(userId) ?? []).filter((t) => now - t < 3_600_000);
  if (times.length >= CHANGES_PER_HOUR) throw new UserError("Cambiaste tu foto muchas veces. Intenta en un rato.", 429);
  times.push(now);
  recentChanges.set(userId, times);
  if (recentChanges.size > 10_000) recentChanges.delete(recentChanges.keys().next().value!);
}

/** Replaces this person's photo; the new one gets a new id (and URL) so caches never show the old one. */
export async function setProfilePhoto(userId: string, base64: string) {
  const { buffer, mime } = decodeImage(base64, {
    tooHeavy: "La foto pesa más de 1 MB. Elige otra o recórtala.",
    format: "Usa una foto JPG o PNG.",
    tooLarge: "La foto es demasiado grande. Elige otra.",
  }, PROFILE_PHOTO_MAX_BYTES);
  throttle(userId);
  const photo = await prisma.$transaction(async (tx) => {
    await tx.fotoPerfil.deleteMany({ where: { usuarioId: userId } });
    const created = await tx.fotoPerfil.create({ data: { usuarioId: userId, mime, datos: buffer }, select: { id: true } });
    await tx.usuario.update({ where: { id: userId }, data: { fotoUrl: profilePhotoPath(created.id) } });
    return created;
  });
  return { fotoUrl: profilePhotoPath(photo.id) };
}

/** Back to initials. A Google photo is removed too: the person chose no photo. */
export async function removeProfilePhoto(userId: string) {
  await prisma.$transaction([
    prisma.fotoPerfil.deleteMany({ where: { usuarioId: userId } }),
    prisma.usuario.update({ where: { id: userId }, data: { fotoUrl: null } }),
  ]);
  return { fotoUrl: null };
}

/** Public, like a Google profile photo URL: the id is random and only shared with the person's groups. */
export function getProfilePhoto(id: string) {
  return prisma.fotoPerfil.findUnique({ where: { id }, select: { mime: true, datos: true, usuario: { select: { activo: true } } } });
}
