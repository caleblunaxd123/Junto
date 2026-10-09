import { ZodError, ZodIssue } from "zod";
const labels: Record<string, string> = {
  nombre: "Nombre", email: "Correo electrónico", password: "Contraseña", newPassword: "Nueva contraseña",
  otp: "Código del correo", celular: "Celular", descripcion: "Descripción", participantes: "Personas",
  montoTotal: "Total del gasto", totalCuenta: "Total de la cuenta", monto: "Monto", consumo: "Consumo",
  extras: "Extras", porcentaje: "Porcentaje", cobrarA: "Quién recibe los aportes", instrucciones: "Instrucciones",
  pagadoPor: "Quién pagó", receptorId: "Quién recibe el pago", usuarioId: "Persona", grupoId: "Grupo",
  metodo: "Método de pago", tipoDivision: "Forma de repartir", division: "Forma de repartir", categoria: "Categoría",
  fecha: "Fecha", notas: "Notas", nota: "Nota", imagen: "Foto", destinatario: "Destinatario",
};
function labelFor(path: (string | number)[]) {
  const last = String(path.at(-1) || "");
  const index = path.find(item => typeof item === "number");
  return `${labels[last] || "Datos del formulario"}${typeof index === "number" ? ` de la persona ${index + 1}` : ""}`;
}
function messageFor(issue: ZodIssue) {
  // Preserve intentional Spanish business guidance. Translate Zod's generated English only.
  if (!/^(Required$|Invalid |Expected |String must |Number must |Array must |Unrecognized key|Invalid$)/.test(issue.message)) return issue.message;
  switch (issue.code) {
    case "invalid_type": return issue.received === "undefined" ? "Completa este campo para continuar." :
      issue.expected === "number" ? "Escribe un monto válido, sin letras ni símbolos." : "Revisa este dato y vuelve a seleccionarlo.";
    case "invalid_string": return issue.validation === "email" ? "Usa un correo como nombre@correo.com, sin espacios." :
      issue.validation === "datetime" ? "Selecciona una fecha válida." : "Revisa este dato y vuelve a seleccionarlo.";
    case "too_small": return issue.type === "string" ? `Escribe al menos ${issue.minimum} caracteres.` :
      issue.type === "array" ? `Selecciona al menos ${issue.minimum} persona(s).` :
        issue.minimum === 0 ? (issue.inclusive ? "El monto no puede ser negativo." : "El monto debe ser mayor que cero.") : "El valor es demasiado pequeño. Revisa este campo.";
    case "too_big": return issue.type === "string" ? `Usa como máximo ${issue.maximum} caracteres.` :
      issue.type === "array" ? `Puedes añadir hasta ${issue.maximum} personas.` :
        issue.path.at(-1) === "porcentaje" ? "El porcentaje no puede superar 100 %." :
          issue.maximum === 999_999_999 ? "El monto máximo es S/ 9,999,999.99." : "El valor supera el límite permitido. Revisa este campo.";
    case "invalid_enum_value": return "Elige una de las opciones disponibles.";
    case "unrecognized_keys": return "El formulario contiene datos no admitidos. Actualiza la app y vuelve a intentar.";
    default: return "Revisa este campo antes de continuar.";
  }
}
export function validationResponse(error: ZodError) {
  const details = error.issues.map(issue => ({field: issue.path.join("."), label: labelFor(issue.path), message: messageFor(issue)}));
  return {error: `${details[0].label}: ${details[0].message}`, code: "VALIDATION_ERROR", details};
}
