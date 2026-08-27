/**
 * Chaves de idempotência para as mutações que a API exige com header:
 * POST /payments, /withdrawals, /refunds, /payment-links e /checkout-sessions.
 *
 * A chave é única por store e ambiente do lado da API, então o valor só
 * precisa ser único aqui. randomUUID cobre o caso normal; o fallback existe
 * para contextos sem crypto (jsdom antigo, http em rede local).
 */
export function createIdempotencyKey(prefix = 'web'): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
