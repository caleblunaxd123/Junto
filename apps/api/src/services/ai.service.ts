import axios from "axios";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  buildExpenseExplanation,
  extractLikelyAmountCents,
  findMentionedMemberIds,
  inferExpenseDescription,
  inferExpenseCategory,
  inferPayerId,
  matchMemberId,
} from "../domain/aiExpense";
import type { InterpretarGastoInput } from "../schemas/ai.schema";

const gatewayProposalSchema = z.object({
  concepto: z.string().min(1).max(200),
  moneda: z.literal("PEN"),
  total_centimos: z.number().int().positive(),
  pagador: z.string().min(1),
  participantes: z.array(z.string().min(1)).min(1),
  categoria: z
    .enum([
      "comida",
      "transporte",
      "entretenimiento",
      "alojamiento",
      "compras",
      "otro",
    ])
    .default("otro"),
  explicacion: z.string().min(1).max(500),
  requiere_revision: z.boolean(),
  confirmacion_requerida: z.literal(true),
  modelo: z.string().max(100).optional(),
});

export class AiServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function interpretarGasto(
  input: InterpretarGastoInput,
  userId: string,
) {
  const membership = await prisma.grupoMiembro.findFirst({
    where: { grupoId: input.grupoId, usuarioId: userId, activo: true },
  });
  if (!membership) throw new AiServiceError("No perteneces a este grupo", 403);

  const members = await prisma.grupoMiembro.findMany({
    where: { grupoId: input.grupoId, activo: true },
    include: { usuario: { select: { id: true, nombre: true } } },
    orderBy: { fechaUnion: "asc" },
  });

  const directory = members.map(({ usuario }) => ({
    id: usuario.id,
    nombre: usuario.nombre,
  }));
  const explicitAmount = extractLikelyAmountCents(input.texto);
  const deterministicPayerId =
    inferPayerId(input.texto, directory, userId);
  const mentionedIds = findMentionedMemberIds(input.texto, directory);
  const normalizedText = input.texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE");
  if (/\b(?:invitad[oa]s?|cumplean(?:os|ero)|propina|consumio|consumimos|porcentaje|por montos|partes distintas|reparto desigual)\b|%/.test(normalizedText)) {
    throw new AiServiceError("Este gasto necesita un reparto especial. Usa «Dividir una cuenta» para invitados, consumos y extras, o revisa las partes manualmente en este formulario.", 422);
  }
  if (/\b(?:usd|dolares|euros)\b|[$€]/.test(normalizedText)) {
    throw new AiServiceError("Por ahora interpreta montos en soles. Escribe el total en PEN antes de continuar.", 422);
  }
  if (!explicitAmount) {
    throw new AiServiceError("Necesito un total claro en soles. Escríbelo como S/120.50; no voy a inventarlo ni calcularlo a partir de datos incompletos.", 422);
  }
  const includesSelf =
    /\b(?:yo|conmigo|yo solo|yo sola)\b/.test(normalizedText) ||
    (/\b(?:pague|gaste|compre)\b/.test(normalizedText) &&
      /\bcon\b/.test(normalizedText));
  const allParticipants = /\b(?:todos|todas|todo el grupo)\b/.test(
    normalizedText,
  );
  const payerIsOnlyMention =
    deterministicPayerId &&
    mentionedIds.length === 1 &&
    mentionedIds[0] === deterministicPayerId;
  const fastParticipantIds =
    allParticipants || mentionedIds.length === 0 || payerIsOnlyMention
      ? directory.map((member) => member.id)
      : [...new Set([...mentionedIds, ...(includesSelf ? [userId] : [])])];

  // Most expense notes are short and explicit. Resolve those locally in a few
  // milliseconds; reserve the model for genuinely ambiguous language.
  if (explicitAmount && deterministicPayerId && fastParticipantIds.length > 0) {
    const category = inferExpenseCategory(input.texto, "otro");
    const description = inferExpenseDescription(input.texto, category);
    const participantNames = fastParticipantIds.flatMap((id) => {
      const name = directory.find((member) => member.id === id)?.nombre;
      return name ? [name] : [];
    });
    const payerName =
      directory.find((member) => member.id === deterministicPayerId)?.nombre ||
      null;
    return {
      descripcion: description,
      montoTotal: explicitAmount,
      pagadoPor: deterministicPayerId,
      participanteIds: fastParticipantIds,
      categoria: category,
      explicacion: buildExpenseExplanation({
        concepto: description,
        totalCents: explicitAmount,
        payerName,
        participantNames,
      }),
      requiereRevision: true,
      nombresSinCoincidencia: [],
      confirmacionRequerida: true as const,
      fuente: "reglas_locales" as const,
    };
  }

  const baseUrl = process.env.JUNTO_AI_BASE_URL;
  const apiKey = process.env.JUNTO_AI_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new AiServiceError(
      "El asistente está temporalmente desactivado",
      503,
    );
  }

  try {
    const response = await axios.post(
      `${baseUrl.replace(/\/$/, "")}/v1/extract-expense`,
      { text: input.texto, members: directory.map(member => member.nombre),
        amount_cents: explicitAmount, current_user_index: directory.findIndex(member => member.id === userId) },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 12_000,
      },
    );
    const proposal = gatewayProposalSchema.parse(response.data);
    const payerId = deterministicPayerId || matchMemberId(proposal.pagador, directory, userId);
    const participantMatches = proposal.participantes.map((name) => ({
      name,
      id: matchMemberId(name, directory, userId),
    }));
    const participantIds = [
      ...new Set(
        participantMatches.flatMap((match) => (match.id ? [match.id] : [])),
      ),
    ];
    const unmatchedNames = participantMatches
      .filter((match) => !match.id)
      .map((match) => match.name);
    const amountCents = explicitAmount;
    if (!payerId || participantIds.length === 0 || unmatchedNames.length > 0) {
      throw new AiServiceError("Revisa quién pagó y para quién fue el gasto. No puedo identificar a todas las personas con seguridad.", 422);
    }
    const category = inferExpenseCategory(input.texto, proposal.categoria);
    const payerName =
      directory.find((member) => member.id === payerId)?.nombre || null;
    const participantNames = participantIds.flatMap((id) => {
      const name = directory.find((member) => member.id === id)?.nombre;
      return name ? [name] : [];
    });

    return {
      descripcion: proposal.concepto,
      montoTotal: amountCents,
      pagadoPor: payerId,
      participanteIds: participantIds,
      categoria: category,
      explicacion: buildExpenseExplanation({
        concepto: proposal.concepto,
        totalCents: amountCents,
        payerName,
        participantNames,
      }),
      requiereRevision: true,
      nombresSinCoincidencia: unmatchedNames,
      confirmacionRequerida: true as const,
      fuente: "ia_local" as const,
      modelo: proposal.modelo,
    };
  } catch (error) {
    if (error instanceof AiServiceError) throw error;
    if (axios.isAxiosError(error) && error.response?.data?.code === "AI_NEEDS_REVIEW") {
      throw new AiServiceError("¿Quién pagó y para quién fue? Añade sus nombres al mensaje o selecciónalos en el formulario.", 422);
    }
    console.error(
      "[AI] Expense interpretation failed",
      error instanceof Error ? error.message : error,
    );
    throw new AiServiceError(
      "No pudimos interpretar el gasto. Puedes completarlo manualmente.",
      502,
    );
  }
}
