import { canRetry, circuitExplanation, deliveryOutcome, outcomeTone } from './delivery';

describe('desfecho de uma entrega', () => {
  it('acredita no status quando a API manda um', () => {
    expect(deliveryOutcome({ status: 'FAILED_FINAL', deliveredAt: '2026-09-16T10:00:00Z' })).toBe(
      'FAILED_FINAL',
    );
  });

  it('ignora status que não conhece e reconstrói', () => {
    expect(deliveryOutcome({ status: 'WAT', deliveredAt: '2026-09-16T10:00:00Z' })).toBe(
      'DELIVERED',
    );
  });

  describe('sem status, com o que sempre existe', () => {
    it('hora de entrega é fato consumado', () => {
      expect(deliveryOutcome({ deliveredAt: '2026-09-16T10:00:00Z' })).toBe('DELIVERED');
    });

    it('resposta 2xx sem falha marcada é entrega', () => {
      expect(deliveryOutcome({ responseStatus: 204 })).toBe('DELIVERED');
    });

    it('resposta de erro com tentativa sobrando ainda vai acontecer', () => {
      expect(deliveryOutcome({ responseStatus: 500, attempt: 2, maxAttempts: 5 })).toBe(
        'FAILED_RETRYABLE',
      );
    });

    it('resposta de erro com tentativa esgotada é falha de vez', () => {
      expect(deliveryOutcome({ responseStatus: 500, attempt: 5, maxAttempts: 5 })).toBe(
        'FAILED_FINAL',
      );
    });

    it('retentativa marcada ganha da contagem de tentativas', () => {
      // O worker é quem sabe; se ele agendou, vai tentar — mesmo que a conta
      // local diga que acabou.
      expect(
        deliveryOutcome({
          failedAt: '2026-09-16T10:00:00Z',
          attempt: 5,
          maxAttempts: 5,
          nextRetryAt: '2026-09-16T10:05:00Z',
        }),
      ).toBe('FAILED_RETRYABLE');
    });

    it('sem nada decidido, está na fila', () => {
      expect(deliveryOutcome({ attempt: 0, maxAttempts: 5 })).toBe('PENDING');
    });
  });

  it('só oferece reenvio do que não chegou', () => {
    expect(canRetry('FAILED_FINAL')).toBe(true);
    expect(canRetry('FAILED_RETRYABLE')).toBe(true);
    expect(canRetry('DELIVERED')).toBe(false);
    expect(canRetry('PENDING')).toBe(false);
  });

  it('a que vai tentar de novo não é vermelha', () => {
    // Vermelho é o que exige ação. Retentativa agendada não exige nenhuma.
    expect(outcomeTone('FAILED_RETRYABLE')).toBe('warn');
    expect(outcomeTone('FAILED_FINAL')).toBe('bad');
  });
});

describe('circuito aberto', () => {
  it('cala a boca quando o circuito está fechado', () => {
    expect(circuitExplanation({ state: 'closed', consecutiveFailures: 0 })).toBeNull();
    expect(circuitExplanation(undefined)).toBeNull();
  });

  it('explica a pausa e garante que nada se perdeu', () => {
    const text = circuitExplanation({ state: 'open', consecutiveFailures: 12 }) ?? '';
    expect(text).toContain('12 falhas seguidas');
    expect(text).toContain('Nenhum evento é perdido');
  });

  it('aguenta uma data inválida sem escrever "Invalid Date"', () => {
    const text = circuitExplanation({
      state: 'open',
      consecutiveFailures: 3,
      openUntil: 'não é data',
    });
    expect(text).not.toContain('Invalid');
  });
});
