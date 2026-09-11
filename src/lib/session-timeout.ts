/**
 * Sessão com validade de 8 horas de inatividade:
 * o usuário permanece logado enquanto usar o sistema e só precisa entrar
 * novamente se ficar mais de 8h sem acessar.
 */
const KEY = "amstore:last_activity";
export const SESSION_MAX_IDLE_MS = 8 * 60 * 60 * 1000;

export function touchActivity() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* ignora indisponibilidade de storage */
  }
}

export function isSessionExpired(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      touchActivity();
      return false;
    }
    const last = Number(raw);
    if (!Number.isFinite(last)) {
      touchActivity();
      return false;
    }
    return Date.now() - last > SESSION_MAX_IDLE_MS;
  } catch {
    return false;
  }
}

export function clearActivity() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
}
