import { prisma } from "./db";

export type ClaimResult =
  | { claimed: true }
  | { claimed: false; reason: "already_claimed" | "not_found" };

export async function claimRoute(routeId: string, driverId: string): Promise<ClaimResult> {
  const result = await prisma.route.updateMany({
    where: { id: routeId, status: "DISPONIVEL" },
    data: { status: "ASSUMIDA", driverId },
  });

  if (result.count === 0) {
    const route = await prisma.route.findUnique({ where: { id: routeId } });
    return route ? { claimed: false, reason: "already_claimed" } : { claimed: false, reason: "not_found" };
  }

  await prisma.routeEvent.create({
    data: { routeId, tipo: "assumida", payload: { driverId } },
  });

  return { claimed: true };
}
