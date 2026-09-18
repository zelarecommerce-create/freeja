import type { Client } from "@prisma/client";
import { prisma } from "./db";
import { createCustomer } from "./asaas";
import { ValidationError } from "./validation";

export interface RegisterClientInput {
  nome: string;
  cpfCnpj: string;
  telefone: string;
  email: string;
}

export async function registerClient(input: RegisterClientInput): Promise<Client> {
  const nome = String(input.nome ?? "").trim();
  const cpfCnpj = String(input.cpfCnpj ?? "").replace(/\D/g, "");
  const telefone = String(input.telefone ?? "").replace(/\D/g, "");
  const email = String(input.email ?? "").trim();

  if (!nome) throw new ValidationError("Nome é obrigatório");
  if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) throw new ValidationError("CPF/CNPJ inválido");
  if (telefone.length < 10) throw new ValidationError("Telefone inválido");
  if (!email.includes("@") || !email.slice(email.indexOf("@")).includes(".")) {
    throw new ValidationError("E-mail inválido");
  }

  const customer = await createCustomer({ nome, cpfCnpj, email, telefone });

  return prisma.client.create({
    data: { nome, cpfCnpj, telefone, email, asaasCustomerId: customer.id },
  });
}
