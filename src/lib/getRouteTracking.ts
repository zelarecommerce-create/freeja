import { prisma } from "./db";
import { calcularHorarioChegada } from "./eta";

export interface RouteTracking {
  status: string;
  etaEstimado: string | null;
  ultimaLocalizacao: string | null;
  eventos: { tipo: string; createdAt: Date }[];
}

export async function getRouteTracking(routeId: string): Promise<RouteTracking> {
  const route = await prisma.route.findUniqueOrThrow({ where: { id: routeId } });
  const eventos = await prisma.routeEvent.findMany({
    where: { routeId },
    orderBy: { createdAt: "asc" },
  });

  const locationEvents = eventos.filter((e) => e.tipo === "localizacao_atualizada");
  const lastLocation = locationEvents.at(-1);
  const ultimaLocalizacao = lastLocation
    ? (lastLocation.payload as { cidade?: string } | null)?.cidade ?? null
    : null;

  const etaEstimado =
    route.status === "ASSUMIDA" || route.status === "EM_TRANSPORTE"
      ? calcularHorarioChegada(route.distanciaKm).toISOString()
      : null;

  return {
    status: route.status,
    etaEstimado,
    ultimaLocalizacao,
    eventos: eventos.map((e) => ({ tipo: e.tipo, createdAt: e.createdAt })),
  };
}
