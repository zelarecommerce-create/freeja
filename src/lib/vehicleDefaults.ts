import type { TipoVeiculo } from "@prisma/client";

export const CAPACIDADE_PADRAO: Record<TipoVeiculo, { capacidadeKg: number; capacidadeM3: number }> = {
  MOTO: { capacidadeKg: 20, capacidadeM3: 0.1 },
  CARRO: { capacidadeKg: 300, capacidadeM3: 1.5 },
  FIORINO: { capacidadeKg: 650, capacidadeM3: 2.8 },
  VAN: { capacidadeKg: 1200, capacidadeM3: 6 },
  CAMINHAO_VUC: { capacidadeKg: 3000, capacidadeM3: 15 },
  CAMINHAO_3_4: { capacidadeKg: 3500, capacidadeM3: 20 },
  TRUCK: { capacidadeKg: 14000, capacidadeM3: 45 },
};
