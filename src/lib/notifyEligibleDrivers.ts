import { prisma } from "./db";
import { filterEligibleDrivers } from "./vehicleMatch";
import { signToken } from "./tokens";
import { sendTextMessage } from "./whatsapp";
import { appUrl } from "./appUrl";

const LINK_EXPIRATION_SECONDS = 60 * 60 * 24; // 24h

export async function notifyEligibleDrivers(routeId: string): Promise<number> {
  const route = await prisma.route.findUniqueOrThrow({ where: { id: routeId } });
  const drivers = await prisma.driver.findMany({ where: { status: "ATIVO" } });

  const eligible = filterEligibleDrivers(
    drivers,
    { pesoKg: route.pesoKg, volumeM3: route.volumeM3 },
    route.origem
  );

  if (eligible.length === 0) {
    console.warn(
      `[notifyEligibleDrivers] nenhum entregador elegível para a rota ${routeId} (origem: "${route.origem}", ${route.pesoKg}kg / ${route.volumeM3}m3)`
    );
  }

  const base = appUrl();
  for (const driver of eligible) {
    const token = signToken({
      routeId: route.id,
      subjectId: driver.id,
      kind: "driver",
      exp: Math.floor(Date.now() / 1000) + LINK_EXPIRATION_SECONDS,
    });
    const link = `${base}/entregador/${token}`;
    await sendTextMessage(
      driver.telefone,
      `Nova rota disponível: ${route.origem} → ${route.destino}. Valor: R$${route.valorTotal}. Assuma aqui: ${link}`
    );
  }

  return eligible.length;
}

export type ReleaseResult =
  | { released: true }
  | { released: false; reason: "not_assigned_to_driver" };

export async function releaseRoute(routeId: string, driverId: string): Promise<ReleaseResult> {
  // Status filter matters: after completeRoute the route keeps driverId, so
  // without it a paid driver could still "desistir" and have the route re-offered.
  const result = await prisma.route.updateMany({
    where: { id: routeId, driverId, status: { in: ["ASSUMIDA", "EM_TRANSPORTE"] } },
    data: { status: "DISPONIVEL", driverId: null },
  });

  if (result.count === 0) {
    return { released: false, reason: "not_assigned_to_driver" };
  }

  await prisma.routeEvent.create({
    data: { routeId, tipo: "desistiu", payload: { driverId } },
  });

  await notifyEligibleDrivers(routeId);

  return { released: true };
}
