export interface CargoRequirement {
  pesoKg: number;
  volumeM3: number;
}

interface DriverForMatch {
  capacidadeKg: number;
  capacidadeM3: number;
  cidadeBase: string;
  status: "ATIVO" | "INATIVO";
}

export function filterEligibleDrivers<T extends DriverForMatch>(
  drivers: T[],
  cargo: CargoRequirement,
  cidadeBase: string
): T[] {
  return drivers.filter(
    (d) =>
      d.status === "ATIVO" &&
      d.cidadeBase === cidadeBase &&
      d.capacidadeKg >= cargo.pesoKg &&
      d.capacidadeM3 >= cargo.volumeM3
  );
}
