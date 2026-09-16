import { prisma } from "./db";
import { uploadComprovante } from "./storage";
import { createTransfer } from "./asaas";

const COMPLETABLE = ["ASSUMIDA", "EM_TRANSPORTE"] as const;

/** Route isn't this driver's, or isn't in a completable status (already CONCLUIDA). */
export class RouteNotCompletableError extends Error {}

function getMargemPercentual(): number {
  const raw = process.env.MARGEM_EMPRESA_PERCENTUAL;
  if (!raw) throw new Error("MARGEM_EMPRESA_PERCENTUAL env var is required");
  const margem = parseFloat(raw);
  if (!Number.isFinite(margem) || margem < 0 || margem >= 1) {
    throw new Error(`MARGEM_EMPRESA_PERCENTUAL deve ser uma fração entre 0 e 1 (ex: "0.20"), recebido: "${raw}"`);
  }
  return margem;
}

export async function completeRoute(routeId: string, driverId: string, comprovanteBase64: string): Promise<void> {
  if (!comprovanteBase64) throw new Error("comprovante é obrigatório");
  const margem = getMargemPercentual(); // validate before anything is written

  const where = { id: routeId, driverId, status: { in: [...COMPLETABLE] } };
  const notCompletable = () =>
    new RouteNotCompletableError("rota não pertence a este entregador ou já foi concluída");

  // Cheap pre-check so a wrong/late driver is rejected before we upload anything.
  const route = await prisma.route.findFirst({ where });
  if (!route) throw notCompletable();

  const driver = await prisma.driver.findUniqueOrThrow({ where: { id: driverId } });
  const comprovanteUrl = await uploadComprovante(routeId, comprovanteBase64);

  // Atomic guard: this is what makes a double-tap safe — the second call gets
  // count === 0 and returns before any money moves.
  const claimed = await prisma.route.updateMany({ where, data: { status: "CONCLUIDA" } });
  if (claimed.count === 0) throw notCompletable();

  await prisma.routeEvent.create({
    data: { routeId, tipo: "concluida", payload: { driverId, comprovanteUrl } },
  });

  const valorRepasse = route.valorTotal * (1 - margem);

  try {
    const transfer = await createTransfer({
      chavePix: driver.chavePix,
      valor: valorRepasse,
      descricao: `Repasse rota ${routeId}`,
    });
    await prisma.payout.create({
      data: { routeId, driverId, asaasTransferId: transfer.id, valorRepasse, status: "pago" },
    });
  } catch {
    // Delivery is already confirmed above — a payout failure (bad PIX
    // key, blocked account) never undoes that. It just needs a human
    // to fix and retry the transfer manually.
    await prisma.payout.create({
      data: { routeId, driverId, asaasTransferId: null, valorRepasse, status: "falhou" },
    });
  }
}
