export const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

export const num = (v: number | null | undefined, digits = 2) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(Number(v ?? 0));

export const dateBR = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("pt-BR") : "—";

export const dateTimeBR = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

export const onlyDigits = (v: string) => (v || "").replace(/\D/g, "");