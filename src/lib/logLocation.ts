import { prisma } from "./db";

export async function logLocation(routeId: string, driverId: string, cidade: string): Promise<void> {
  await prisma.routeEvent.create({
    data: { routeId, tipo: "localizacao_atualizada", payload: { driverId, cidade } },
  });
}
