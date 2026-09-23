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
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year !== undefined && month !== undefined && day !== undefined && !isNaN(year) && !isNaN(month) && !isNaN(day)) {
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

/**
 * Data como "YYYY-MM-DD" no FUSO DE BRASÍLIA / SÃO PAULO (America/Sao_Paulo).
 * Independe do fuso do dispositivo do usuário ou do servidor UTC.
 */
export const getSaoPauloDateStr = (date: Date = new Date()): string => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

/**
 * Data de hoje como "YYYY-MM-DD" no fuso oficial de Brasília.
 */
export const getLocalDateStr = (): string => getSaoPauloDateStr();

/**
 * Retorna os limites de "hoje" (ou data base) no fuso de São Paulo / Brasília
 * convertidos para timestamps e strings ISO UTC exatas para queries em colunas timestamptz (created_at).
 *
 * Exemplo em São Paulo (UTC-3):
 *   dateStr        = "2026-09-23"
 *   startISO       = "2026-09-23T03:00:00.000Z"  (00:00:00 em Brasília)
 *   endISO         = "2026-09-24T02:59:59.999Z"  (23h59m59s em Brasília)
 *   startTimestamp = 1790132400000
 *   endTimestamp   = 1790218799999
 */
export const getSaoPauloTodayBoundaries = (baseDate: Date = new Date()) => {
  const dateStr = getSaoPauloDateStr(baseDate);
  const startISO = new Date(`${dateStr}T00:00:00.000-03:00`).toISOString();
  const endISO = new Date(`${dateStr}T23:59:59.999-03:00`).toISOString();
  return {
    dateStr,
    startISO,
    endISO,
    startTimestamp: new Date(startISO).getTime(),
    endTimestamp: new Date(endISO).getTime(),
  };
};

/**
 * Alias compatível com código existente.
 */
export const getLocalTodayBoundaries = getSaoPauloTodayBoundaries;

/**
 * Retorna true se a data informada (string ISO UTC ou Date) pertence ao dia de hoje
 * no fuso horário oficial de Brasília / São Paulo.
 */
export const isTodaySaoPaulo = (
  dateInput: string | Date | null | undefined,
  baseTodayStr?: string
): boolean => {
  if (!dateInput) return false;
  const targetDateStr = baseTodayStr || getSaoPauloDateStr();
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return false;
  return getSaoPauloDateStr(d) === targetDateStr;
};