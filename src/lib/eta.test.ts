import { describe, it, expect } from "vitest";
import { calcularHorarioChegada, calcularEtaMinutos } from "./eta";

describe("eta", () => {
  it("calcula minutos com base em 60km/h", () => {
    expect(calcularEtaMinutos(60)).toBe(60);
    expect(calcularEtaMinutos(30)).toBe(30);
  });

  it("retorna 0 pra distancia zero ou negativa", () => {
    expect(calcularEtaMinutos(0)).toBe(0);
    expect(calcularEtaMinutos(-5)).toBe(0);
  });

  it("soma os minutos ao horario base", () => {
    const agora = new Date("2026-09-16T10:00:00Z");
    const chegada = calcularHorarioChegada(120, agora);
    expect(chegada.toISOString()).toBe("2026-09-16T12:00:00.000Z");
  });
});
