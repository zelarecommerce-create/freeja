import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "./db";
import { registerDriver } from "./registerDriver";
import { ValidationError } from "./validation";

const uniqCpf = () => String(Math.floor(Math.random() * 1e11)).padStart(11, "0");
const fmt = (c: string) => `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;

const base = () => ({
  nome: "Motorista Teste",
  cpf: uniqCpf(),
  telefone: "(11) 99999-1234",
  chavePix: "pix@example.com",
  rntrc: "12345678",
  cidadeBase: "São Paulo",
  tipoVeiculo: "FIORINO",
});

describe("registerDriver", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("defaults capacities from the vehicle type", async () => {
    const d = await registerDriver(base());
    expect(d.capacidadeKg).toBe(650);
    expect(d.capacidadeM3).toBe(2.8);
    expect(d.status).toBe("ATIVO");
  });

  it("lets explicit capacities override the defaults", async () => {
    const d = await registerDriver({ ...base(), capacidadeKg: 700, capacidadeM3: 3 });
    expect(d.capacidadeKg).toBe(700);
    expect(d.capacidadeM3).toBe(3);
  });

  it("stores a formatted CPF digits-only", async () => {
    const cpf = uniqCpf();
    const d = await registerDriver({ ...base(), cpf: fmt(cpf) });
    expect(d.cpf).toBe(cpf);
  });

  it("rejects a duplicate CPF", async () => {
    const cpf = uniqCpf();
    await registerDriver({ ...base(), cpf });
    await expect(registerDriver({ ...base(), cpf })).rejects.toThrow(new ValidationError("CPF já cadastrado"));
    await expect(registerDriver({ ...base(), cpf })).rejects.toBeInstanceOf(ValidationError);
  });

  it("stores the phone with the 55 country code", async () => {
    const d = await registerDriver(base());
    expect(d.telefone).toBe("5511999991234");
  });

  it("adds the country code to a DDD 55 number", async () => {
    const d = await registerDriver({ ...base(), telefone: "(55) 99999-1234" });
    expect(d.telefone).toBe("5555999991234");
  });

  it("rejects an unknown vehicle type", async () => {
    await expect(registerDriver({ ...base(), tipoVeiculo: "BICICLETA" })).rejects.toBeInstanceOf(ValidationError);
  });
});
