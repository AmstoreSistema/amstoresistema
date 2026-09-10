/**
 * Utilitários para detecção e manipulação de aniversariantes
 */

export function isBirthdayToday(dateStr: string | null | undefined): boolean {
  if (!dateStr || typeof dateStr !== "string") return false;

  const clean = dateStr.trim();
  if (!clean) return false;

  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth() + 1;

  // Se vier no formato ISO: YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss...
  if (clean.includes("-")) {
    const onlyDate = clean.split("T")[0] ?? clean;
    const parts = onlyDate.split("-");
    if (parts.length === 3) {
      const [p0 = "", p1 = "", p2 = ""] = parts;
      if (p0.length === 4) {
        // YYYY-MM-DD
        const month = parseInt(p1, 10);
        const day = parseInt(p2, 10);
        return day === currentDay && month === currentMonth;
      } else {
        // DD-MM-YYYY
        const day = parseInt(p0, 10);
        const month = parseInt(p1, 10);
        return day === currentDay && month === currentMonth;
      }
    }
  }

  // Se vier no formato brasileiro: DD/MM/YYYY ou DD/MM
  if (clean.includes("/")) {
    const parts = clean.split("/");
    if (parts.length >= 2) {
      const day = parseInt(parts[0] ?? "", 10);
      const month = parseInt(parts[1] ?? "", 10);
      return day === currentDay && month === currentMonth;
    }
  }


  // Tentativa de fallback com Date
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return parsed.getUTCDate() === currentDay && (parsed.getUTCMonth() + 1) === currentMonth;
  }

  return false;
}

export function filterBirthdaysToday<T = any>(clients: T[]): T[] {
  return (clients || []).filter((c: any) => {
    const bDate = c.birth_date || c.data_aniversario || c.birthday;
    return isBirthdayToday(bDate);
  });
}

export const BIRTHDAYS_SHOWN_STORAGE_KEY = "aniversariantes_mostrado_data";

export function getTodayDateKey(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `${day}-${month}-${year}`;
}

export function isWithinDisplayHours(): boolean {
  const hour = new Date().getHours();
  return hour >= 9 && hour < 18;
}

export function hasAlreadyShownToday(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(BIRTHDAYS_SHOWN_STORAGE_KEY) === getTodayDateKey();
}

export function markAsShownToday(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BIRTHDAYS_SHOWN_STORAGE_KEY, getTodayDateKey());
}
