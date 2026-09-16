import { prisma } from "./db";
import { createCharge } from "./asaas";
import type { Route } from "@prisma/client";

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

export async function createRouteWithCharge(input: CreateRouteInput): Promise<Route> {
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

  return route;
}
