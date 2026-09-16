import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "./db";

describe("db connection", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("can write and read a Client row", async () => {
    const client = await prisma.client.create({
      data: { nome: "Seller Teste", telefone: "11999999999", email: "teste@example.com" },
    });

    const found = await prisma.client.findUnique({ where: { id: client.id } });

    expect(found?.nome).toBe("Seller Teste");

    await prisma.client.delete({ where: { id: client.id } });
  });
});
