import { prisma } from "./db";
import { uploadComprovante } from "./storage";
import { createTransfer } from "./asaas";

function getMargemPercentual(): number {
  const raw = process.env.MARGEM_EMPRESA_PERCENTUAL;
  if (!raw) throw new Error("MARGEM_EMPRESA_PERCENTUAL env var is required");
  return parseFloat(raw);
}

export async function completeRoute(routeId: string, driverId: string, comprovanteBase64: string): Promise<void> {
  if (!comprovanteBase64) throw new Error("comprovante é obrigatório");

  const route = await prisma.route.findUniqueOrThrow({ where: { id: routeId } });
  const driver = await prisma.driver.findUniqueOrThrow({ where: { id: driverId } });

  const comprovanteUrl = await uploadComprovante(routeId, comprovanteBase64);

  await prisma.route.update({ where: { id: routeId }, data: { status: "CONCLUIDA" } });
  await prisma.routeEvent.create({
    data: { routeId, tipo: "concluida", payload: { driverId, comprovanteUrl } },
  });

  const valorRepasse = route.valorTotal * (1 - getMargemPercentual());

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
