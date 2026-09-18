import { Prisma } from "@prisma/client";
import type { Driver, TipoVeiculo } from "@prisma/client";
import { prisma } from "./db";
import { ValidationError } from "./validation";
import { CAPACIDADE_PADRAO } from "./vehicleDefaults";

export interface RegisterDriverInput {
  nome: string;
  cpf: string;
  telefone: string;
  chavePix: string;
  rntrc: string;
  cidadeBase: string;
  tipoVeiculo: string;
  capacidadeKg?: number;
  capacidadeM3?: number;
}

function capacity(value: number | undefined, fallback: number, label: string): number {
  if (value === undefined || value === null) return fallback;
  if (!Number.isFinite(value) || value <= 0) throw new ValidationError(`${label} inválida`);
  return value;
}

export async function registerDriver(input: RegisterDriverInput): Promise<Driver> {
  const nome = String(input.nome ?? "").trim();
  const chavePix = String(input.chavePix ?? "").trim();
  const rntrc = String(input.rntrc ?? "").trim();
  const cidadeBase = String(input.cidadeBase ?? "").trim();
  const cpf = String(input.cpf ?? "").replace(/\D/g, "");
  let telefone = String(input.telefone ?? "").replace(/\D/g, "");

  if (!nome) throw new ValidationError("Nome é obrigatório");
  if (!chavePix) throw new ValidationError("Chave Pix é obrigatória");
  if (!rntrc) throw new ValidationError("RNTRC é obrigatório");
  if (!cidadeBase) throw new ValidationError("Cidade base é obrigatória");
  if (cpf.length !== 11) throw new ValidationError("CPF inválido");
  if (telefone.length < 10 || telefone.length > 13) throw new ValidationError("Telefone inválido");
  if (!Object.keys(CAPACIDADE_PADRAO).includes(input.tipoVeiculo)) throw new ValidationError("Tipo de veículo inválido");

  // WhatsApp Cloud API needs the country code; notifyEligibleDrivers sends this as-is.
  if (!telefone.startsWith("55") && telefone.length <= 11) telefone = `55${telefone}`;

  const tipoVeiculo = input.tipoVeiculo as TipoVeiculo;
  const padrao = CAPACIDADE_PADRAO[tipoVeiculo];

  try {
    return await prisma.driver.create({
      data: {
        nome,
        cpf,
        telefone,
        chavePix,
        rntrc,
        cidadeBase,
        tipoVeiculo,
        capacidadeKg: capacity(input.capacidadeKg, padrao.capacidadeKg, "Capacidade em kg"),
        capacidadeM3: capacity(input.capacidadeM3, padrao.capacidadeM3, "Capacidade em m³"),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ValidationError("CPF já cadastrado");
    }
    throw err;
  }
}
