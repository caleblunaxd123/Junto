import axios from 'axios';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { sendPushNotification } from '../lib/firebase';
import type { ProcesarPagoInput } from '../schemas/pagos.schema';

const CULQI_API = 'https://api.culqi.com/v2';
const JUNTO_FEE_RATE = 0.01; // 1%

interface CulqiChargeBody {
  amount: number;
  currency_code: string;
  email: string;
  source_id: string;
  description: string;
  metadata?: Record<string, string>;
}

interface CulqiChargeResponse {
  id: string;
  object: string;
  amount: number;
  currency_code: string;
  outcome: {
    type: string;
    code: string;
    merchant_message: string;
    user_message: string;
  };
  source: { object: string };
}

export async function procesarPago(input: ProcesarPagoInput, acreedorId: string) {
  const feejunto = Math.round(input.monto * JUNTO_FEE_RATE);
  const montoTotal = input.monto + feejunto;

  // Fetch grupo info for description
  const grupo = await prisma.grupo.findUnique({
    where: { id: input.grupoId },
    select: { nombre: true },
  });

  const chargeBody: CulqiChargeBody = {
    amount: montoTotal,
    currency_code: 'PEN',
    email: input.email,
    source_id: input.tokenId,
    description: `Junto - ${grupo?.nombre || 'Grupo'} - Pago de deuda`,
    metadata: {
      grupoId: input.grupoId,
      pagadorId: input.deudorId,
      receptorId: acreedorId,
    },
  };

  let chargeResponse: CulqiChargeResponse;

  try {
    const response = await axios.post(`${CULQI_API}/charges`, chargeBody, {
      headers: {
        Authorization: `Bearer ${process.env.CULQI_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    chargeResponse = response.data;
  } catch (err: unknown) {
    const error = err as { response?: { data?: { user_message?: string } } };
    const culqiError = error?.response?.data?.user_message || 'Error al procesar el pago';
    throw new Error(culqiError);
  }

  const exitoso = chargeResponse.outcome?.type === 'venta_exitosa';
  const estado = exitoso ? 'exitoso' : 'fallido';

  // Record payment
  const pago = await prisma.pago.create({
    data: {
      grupoId: input.grupoId,
      pagadorId: input.deudorId,
      receptorId: acreedorId,
      monto: input.monto,
      feejunto,
      metodo: input.metodo,
      culqiChargeId: chargeResponse.id,
      estado,
    },
  });

  if (exitoso) {
    // Notify creditor
    const [receptor, pagador] = await Promise.all([
      prisma.usuario.findUnique({
        where: { id: acreedorId },
        select: { expoPushToken: true },
      }),
      prisma.usuario.findUnique({
        where: { id: input.deudorId },
        select: { nombre: true },
      }),
    ]);

    if (receptor?.expoPushToken && pagador) {
      const montoStr = (input.monto / 100).toFixed(2);
      await sendPushNotification(
        receptor.expoPushToken,
        '¡Te pagaron!',
        `${pagador.nombre} te pagó S/${montoStr} 💚`,
        { grupoId: input.grupoId, pagoId: pago.id, type: 'pago_recibido' }
      );
    }
  }

  return { pago, exitoso, mensaje: chargeResponse.outcome?.user_message };
}

export async function getHistorialPagos(usuarioId: string) {
  return prisma.pago.findMany({
    where: {
      OR: [{ pagadorId: usuarioId }, { receptorId: usuarioId }],
    },
    include: {
      pagador: { select: { id: true, nombre: true, fotoUrl: true } },
      receptor: { select: { id: true, nombre: true, fotoUrl: true } },
      grupo: { select: { id: true, nombre: true } },
    },
    orderBy: { fechaPago: 'desc' },
  });
}

/**
 * Validates the Culqi webhook signature using HMAC-SHA256.
 */
export function validarWebhookCulqi(payload: string, signature: string): boolean {
  const secret = process.env.CULQI_WEBHOOK_SECRET;
  if (!secret) return false;

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
