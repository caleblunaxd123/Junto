import { validShareEmail } from "@junto/shared/share";
export const emailError = (email: string) => !email.trim() ? "Escribe tu correo electrónico." :
  !validShareEmail(email.trim()) ? "Usa un correo como nombre@correo.com, sin espacios." : "";
export const nameError = (name: string) => name.trim().length < 2 ? "Escribe al menos 2 caracteres: así te reconocerán." :
  name.trim().length > 100 ? "Usa como máximo 100 caracteres para tu nombre." : "";
export const passwordError = (password: string) => password.length < 8 ? "Usa al menos 8 caracteres y un número." :
  !/\d/.test(password) ? "Añade al menos un número a tu contraseña." : "";
export const phoneError = (phone: string) => phone.trim() && !/^9\d{8}$/.test(phone.trim()) ?
  "Escribe 9 dígitos, empezando en 9. No incluyas +51 ni espacios." : "";
export const codeError = (code: string) => /^\d{6}$/.test(code) ? "" : "Completa los 6 dígitos del correo. Usa el código más reciente.";
export const confirmationError = (password: string, confirm: string) => password === confirm ? "" : "Las contraseñas no coinciden. Escríbelas igual en ambos campos.";
