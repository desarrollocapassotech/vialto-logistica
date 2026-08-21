export const COMBUSTIBLE_SORT_FIELDS = [
  "fecha_creacion",
  "fecha_carga",
] as const;

export type CombustibleSortField = (typeof COMBUSTIBLE_SORT_FIELDS)[number];
export type CombustibleSortDir = "asc" | "desc";

export const COMBUSTIBLE_SORT_DEFAULT: {
  sortBy: CombustibleSortField;
  sortDir: CombustibleSortDir;
} = {
  sortBy: "fecha_creacion",
  sortDir: "desc",
};

export const COMBUSTIBLE_SORT_LABELS: Record<CombustibleSortField, string> = {
  fecha_creacion: "Fecha de creación",
  fecha_carga: "Fecha de carga",
};

export function etiquetaCombustibleOrdenamiento(
  sortBy: CombustibleSortField,
  sortDir: CombustibleSortDir,
): string {
  const base = COMBUSTIBLE_SORT_LABELS[sortBy];
  return sortDir === "asc"
    ? `${base} (de vieja a nueva)`
    : `${base} (de nueva a vieja)`;
}

export function etiquetaDirDesc(_field: CombustibleSortField): string {
  return "De nueva a vieja";
}

export function etiquetaDirAsc(_field: CombustibleSortField): string {
  return "De vieja a nueva";
}

export function appendCombustibleSortQuery(
  params: URLSearchParams,
  sortBy: CombustibleSortField,
  sortDir: CombustibleSortDir,
): void {
  params.set("sortBy", sortBy);
  params.set("sortDir", sortDir);
}
