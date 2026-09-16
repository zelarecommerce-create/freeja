import { prisma } from "./db";

/**
 * Records a location ping. Returns false when the route is not this driver's
 * active claim — the link is broadcast to every eligible driver, so being able
 * to call this endpoint is not proof of being the one carrying the load.
 */
export async function logLocation(routeId: string, driverId: string, cidade: string): Promise<boolean> {
  const route = await prisma.route.findFirst({
    where: { id: routeId, driverId, status: { in: ["ASSUMIDA", "EM_TRANSPORTE"] } },
  });
  if (!route) return false;

  await prisma.routeEvent.create({
    data: { routeId, tipo: "localizacao_atualizada", payload: { driverId, cidade } },
  });
  return true;
}
