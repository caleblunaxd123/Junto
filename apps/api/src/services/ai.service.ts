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
    inferPayerId(input.texto, directory, userId) || userId;
  const mentionedIds = findMentionedMemberIds(input.texto, directory);
  const normalizedText = input.texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE");
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

  const memberDirectory = members
    .map(({ usuario }) => usuario.nombre)
    .join(", ");
  const contextualizedText = [
    `Miembros válidos del grupo: ${memberDirectory}.`,
    "Usa únicamente esos nombres para pagador y participantes.",
    `Gasto descrito por el usuario: ${input.texto}`,
  ].join("\n");

  try {
    const response = await axios.post(
      `${baseUrl.replace(/\/$/, "")}/v1/extract-expense`,
      { text: contextualizedText },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 15_000,
      },
    );
    const proposal = gatewayProposalSchema.parse(response.data);
    const payerId = matchMemberId(proposal.pagador, directory, userId);
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
    const amountCents =
      extractLikelyAmountCents(input.texto) || proposal.total_centimos;
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
      requiereRevision:
        proposal.requiere_revision ||
        !payerId ||
        participantIds.length === 0 ||
        unmatchedNames.length > 0,
      nombresSinCoincidencia: unmatchedNames,
      confirmacionRequerida: true as const,
    };
  } catch (error) {
    if (error instanceof AiServiceError) throw error;
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
