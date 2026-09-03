export const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

export const num = (v: number | null | undefined, digits = 2) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(Number(v ?? 0));

const pad = (n: number) => String(n).padStart(2, "0");

/** Formata sempre como dd/mm/aaaa, independente do locale do ambiente. */
export const dateBR = (v: string | number | Date | null | undefined) => {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export const dateTimeBR = (v: string | number | Date | null | undefined) => {
  if (!v) return "—";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return `${dateBR(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** aaaa-mm-dd local, útil para inputs type="date". */
export const toISODate = (v: string | number | Date | null | undefined) => {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const onlyDigits = (v: string) => (v || "").replace(/\D/g, "");