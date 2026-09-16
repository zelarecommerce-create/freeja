import { prisma } from "./db";
import { createCharge } from "./asaas";
import { signToken } from "./tokens";
import { appUrl } from "./appUrl";
import type { Route } from "@prisma/client";

// Covers the whole lifecycle of a route, payment window included.
const CLIENT_TRACKING_SECONDS = 60 * 60 * 24 * 30;

export interface CreateRouteInput {
  clientId: string;
  clientAsaasId: string;
  origem: string;
  destino: string;
  distanciaKm: number;
  valorKm: number;
  pesoKg: number;
  volumeM3: number;
}

export type CreatedRoute = Route & { clienteTrackingUrl: string };

export async function createRouteWithCharge(input: CreateRouteInput): Promise<CreatedRoute> {
  const base = appUrl(); // fail before creating a route/charge we can't link to
  const valorTotal = input.distanciaKm * input.valorKm;

  const route = await prisma.route.create({
    data: {
      clientId: input.clientId,
      origem: input.origem,
      destino: input.destino,
      distanciaKm: input.distanciaKm,
      valorKm: input.valorKm,
      valorTotal,
      pesoKg: input.pesoKg,
      volumeM3: input.volumeM3,
      status: "AGUARDANDO_PAGAMENTO",
    },
  });

  const charge = await createCharge({
    customerAsaasId: input.clientAsaasId,
    valor: valorTotal,
    descricao: `Frete ${input.origem} -> ${input.destino}`,
    externalReference: route.id,
  });

  await prisma.payment.create({
    data: {
      routeId: route.id,
      asaasChargeId: charge.id,
      valorRecebido: 0,
      status: charge.status,
    },
  });

  // The team forwards this link to the client by hand for now.
  const clienteToken = signToken({
    routeId: route.id,
    subjectId: input.clientId,
    kind: "client",
    exp: Math.floor(Date.now() / 1000) + CLIENT_TRACKING_SECONDS,
  });

  return { ...route, clienteTrackingUrl: `${base}/cliente/${clienteToken}` };
}
