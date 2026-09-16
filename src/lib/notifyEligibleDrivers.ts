import { prisma } from "./db";
import { filterEligibleDrivers } from "./vehicleMatch";
import { signToken } from "./tokens";
import { sendTextMessage } from "./whatsapp";

const LINK_EXPIRATION_SECONDS = 60 * 60 * 24; // 24h

export async function notifyEligibleDrivers(routeId: string): Promise<number> {
  const route = await prisma.route.findUniqueOrThrow({ where: { id: routeId } });
  const drivers = await prisma.driver.findMany({ where: { status: "ATIVO" } });

  const eligible = filterEligibleDrivers(
    drivers,
    { pesoKg: route.pesoKg, volumeM3: route.volumeM3 },
    route.origem
  );

  for (const driver of eligible) {
    const token = signToken({
      routeId: route.id,
      subjectId: driver.id,
      kind: "driver",
      exp: Math.floor(Date.now() / 1000) + LINK_EXPIRATION_SECONDS,
    });
    const link = `${process.env.APP_URL ?? ""}/entregador/${token}`;
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
  const result = await prisma.route.updateMany({
    where: { id: routeId, driverId },
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
