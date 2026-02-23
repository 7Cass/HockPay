/**
 * Format amount in cents to Brazilian Real currency
 */
export function formatCurrency(amountInCents: number, currency = 'BRL'): string {
  const amount = amountInCents / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format a date to Brazilian format
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Calculate remaining time in seconds until expiration
 */
export function getRemainingSeconds(expiresAt: string): number {
  const now = new Date();
  const expiration = new Date(expiresAt);
  const diff = Math.floor((expiration.getTime() - now.getTime()) / 1000);
  return Math.max(0, diff);
}

/**
 * Format remaining seconds to MM:SS
 */
export function formatTimeRemaining(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
