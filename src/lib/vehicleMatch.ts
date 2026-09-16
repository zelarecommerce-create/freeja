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

// Both sides are free text typed by humans ("São Paulo " vs "sao paulo"), so
// compare them trimmed, lowercased and accent-folded.
// ponytail: still exact-match after folding — "São Paulo - SP" won't match
// "São Paulo". Upgrade path: a city picker / geocoded ids on both sides.
function normalizeCidade(cidade: string): string {
  return cidade.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function filterEligibleDrivers<T extends DriverForMatch>(
  drivers: T[],
  cargo: CargoRequirement,
  cidadeBase: string
): T[] {
  const alvo = normalizeCidade(cidadeBase);
  return drivers.filter(
    (d) =>
      d.status === "ATIVO" &&
      normalizeCidade(d.cidadeBase) === alvo &&
      d.capacidadeKg >= cargo.pesoKg &&
      d.capacidadeM3 >= cargo.volumeM3
  );
}
