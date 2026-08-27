import { type Tone } from '../../../../shared/ui';

/**
 * O tom de um link de pagamento.
 *
 * `ACTIVE` sai do vocabulário global de propósito: um produto ativo está de
 * pé, mas um link ativo é só uma cobrança à espera de alguém — não é vitória
 * nenhuma até virar `PAID`.
 */
const LINK_TONES: Readonly<Record<string, Tone>> = {
    ACTIVE: 'neutral',
    OPENED: 'warn',
    PAID: 'ok',
    EXPIRED: 'bad',
    CANCELLED: 'bad',
};

export function linkTone(status: string): Tone | undefined {
    return LINK_TONES[status];
}
