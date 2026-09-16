import { describe, it, expect } from "vitest";
import { filterEligibleDrivers } from "./vehicleMatch";

const baseDriver = {
  cidadeBase: "São Paulo",
  status: "ATIVO" as const,
};

describe("filterEligibleDrivers", () => {
  it("excludes a driver whose vehicle can't carry the weight", () => {
    const drivers = [{ ...baseDriver, id: "1", capacidadeKg: 50, capacidadeM3: 1 }];
    const result = filterEligibleDrivers(drivers, { pesoKg: 100, volumeM3: 0.5 }, "São Paulo");
    expect(result).toHaveLength(0);
  });

  it("excludes a driver in a different city", () => {
    const drivers = [{ ...baseDriver, id: "1", cidadeBase: "Campinas", capacidadeKg: 500, capacidadeM3: 5 }];
    const result = filterEligibleDrivers(drivers, { pesoKg: 100, volumeM3: 0.5 }, "São Paulo");
    expect(result).toHaveLength(0);
  });

  it("excludes an inactive driver", () => {
    const drivers = [{ ...baseDriver, id: "1", status: "INATIVO" as const, capacidadeKg: 500, capacidadeM3: 5 }];
    const result = filterEligibleDrivers(drivers, { pesoKg: 100, volumeM3: 0.5 }, "São Paulo");
    expect(result).toHaveLength(0);
  });

  it("matches cities regardless of case, accents and stray whitespace", () => {
    const drivers = [{ ...baseDriver, id: "1", cidadeBase: "  sao paulo ", capacidadeKg: 500, capacidadeM3: 5 }];
    const result = filterEligibleDrivers(drivers, { pesoKg: 100, volumeM3: 0.5 }, "São Paulo");
    expect(result).toHaveLength(1);
  });

  it("includes a driver whose vehicle fits exactly", () => {
    const drivers = [{ ...baseDriver, id: "1", capacidadeKg: 100, capacidadeM3: 0.5 }];
    const result = filterEligibleDrivers(drivers, { pesoKg: 100, volumeM3: 0.5 }, "São Paulo");
    expect(result).toHaveLength(1);
  });
});
