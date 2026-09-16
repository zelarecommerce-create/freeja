// ponytail: fixed average speed, not live traffic/maps data.
// Upgrade path: swap for a maps/directions API call if ETA accuracy
// starts mattering (e.g. client complaints about wrong estimates).
const VELOCIDADE_MEDIA_KMH = 60;

export function calcularEtaMinutos(distanciaKm: number): number {
  if (distanciaKm <= 0) return 0;
  return Math.round((distanciaKm / VELOCIDADE_MEDIA_KMH) * 60);
}

export function calcularHorarioChegada(distanciaKm: number, agora: Date = new Date()): Date {
  const minutos = calcularEtaMinutos(distanciaKm);
  return new Date(agora.getTime() + minutos * 60_000);
}
