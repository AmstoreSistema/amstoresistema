export const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

export const num = (v: number | null | undefined, digits = 2) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(Number(v ?? 0));

const pad = (n: number) => String(n).padStart(2, "0");

/** Formata sempre como dd/mm/aaaa, tolerante a timestamps UTC sem hora (evita recuar 1 dia em GMT-3). */
export const dateBR = (v: string | number | Date | null | undefined) => {
  if (!v) return "—";
  if (typeof v === "string") {
    const s = v.trim();
    // String pura "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [year, month, day] = s.split("-");
      return `${day}/${month}/${year}`;
    }
    // Timestamp ISO gravado a partir de data pura (meia-noite UTC, ex: "2026-08-25T00:00:00...")
    const match = s.match(/^(\d{4})-(\d{2})-(\d{2})T00:00:00/);
    if (match && (s.includes("Z") || s.includes("+00"))) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
  }
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export const dateTimeBR = (v: string | number | Date | null | undefined) => {
  if (!v) return "—";
  if (typeof v === "string") {
    const s = v.trim();
    // Se for data pura salva à meia-noite UTC sem hora real
    const match = s.match(/^(\d{4})-(\d{2})-(\d{2})T00:00:00/);
    if (match && (s.includes("Z") || s.includes("+00"))) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
  }
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return `${dateBR(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** aaaa-mm-dd local, útil para inputs type="date". */
export const toISODate = (v: string | number | Date | null | undefined) => {
  if (!v) return "";
  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const match = s.match(/^(\d{4})-(\d{2})-(\d{2})T00:00:00/);
    if (match && (s.includes("Z") || s.includes("+00"))) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Converte uma data de input "YYYY-MM-DD" para ISO garantindo horário neutro/local sem recuo de 1 dia */
export const formatSaleDateISO = (saleDateString?: string | null): string => {
  const now = new Date();
  if (!saleDateString) return now.toISOString();

  if (saleDateString.includes("T")) {
    return new Date(saleDateString).toISOString();
  }

  const parts = saleDateString.split("-").map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    const [year, month, day] = parts;
    const isToday =
      year === now.getFullYear() &&
      month === now.getMonth() + 1 &&
      day === now.getDate();

    const localDate = isToday
      ? new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds())
      : new Date(year, month - 1, day, 12, 0, 0);

    return localDate.toISOString();
  }

  return new Date(saleDateString).toISOString();
};

export const onlyDigits = (v: string) => (v || "").replace(/\D/g, "");