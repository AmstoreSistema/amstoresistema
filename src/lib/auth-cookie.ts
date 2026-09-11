/**
 * Persiste o refresh token em cookie HTTP para que a sessão sobreviva
 * mesmo se o localStorage for limpo pelo navegador (ex.: configurações de
 * privacidade, "limpar dados ao fechar" no Chrome/Firefox no desktop).
 *
 * O cookie tem validade de 8 dias (mesmo que o timeout de inatividade) e é
 * usado como fallback quando getSession() retorna null.
 */

const COOKIE_KEY = 'amstore_rt';
const MAX_AGE_SECONDS = 8 * 24 * 60 * 60; // 8 dias

export function saveRefreshTokenCookie(refreshToken: string): void {
  if (typeof document === 'undefined') return;
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = [
    `${COOKIE_KEY}=${encodeURIComponent(refreshToken)}`,
    `max-age=${MAX_AGE_SECONDS}`,
    'path=/',
    'SameSite=Lax',
    secure,
  ].filter(Boolean).join('; ');
}

export function getRefreshTokenCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_KEY}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearRefreshTokenCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_KEY}=; max-age=0; path=/`;
}
