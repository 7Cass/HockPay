import {
  canSimulateLink,
  isLinkTerminal,
  linkSimulationBlocker,
  linkTone,
  outcomesFor,
  refundBlocker,
  refundableAmount,
} from './charge-outcomes';

describe('desfechos de uma cobrança', () => {
  it('oferece os três finais de uma cobrança viva', () => {
    expect(outcomesFor('PENDING').map((o) => o.action)).toEqual(['confirm', 'fail', 'expire']);
  });

  it('oferece só a liberação depois de confirmada', () => {
    // É o que o settlement faria sozinho em D+30.
    expect(outcomesFor('CONFIRMED').map((o) => o.action)).toEqual(['release']);
  });

  it('não oferece nada em estado morto', () => {
    for (const status of ['RELEASED', 'FAILED', 'EXPIRED', 'REFUNDED']) {
      expect(outcomesFor(status)).toEqual([]);
    }
  });

  it('é indiferente a caixa', () => {
    expect(outcomesFor('pending')).toHaveLength(3);
  });

  it('descreve o efeito de cada ação', () => {
    // O segundo passo da confirmação lê isso; sem frase, o botão vira aposta.
    for (const outcome of outcomesFor('PENDING')) {
      expect(outcome.effect.length).toBeGreaterThan(20);
    }
  });
});

describe('link de pagamento', () => {
  it('trata ACTIVE como neutro, e não como vitória', () => {
    expect(linkTone('ACTIVE')).toBe('neutral');
    expect(linkTone('PAID')).toBe('ok');
    expect(linkTone('EXPIRED')).toBe('bad');
  });

  it('não conhece status de fora do vocabulário do link', () => {
    expect(linkTone('QUALQUER')).toBeUndefined();
  });

  it('reconhece os estados terminais', () => {
    expect(isLinkTerminal('PAID')).toBe(true);
    expect(isLinkTerminal('ACTIVE')).toBe(false);
  });

  describe('simulação', () => {
    it('exige link vivo e cobrança aberta', () => {
      expect(canSimulateLink('ACTIVE', 'OPEN')).toBe(true);
      expect(canSimulateLink('ACTIVE', 'PAID')).toBe(false);
      expect(canSimulateLink('CANCELLED', 'OPEN')).toBe(false);
    });

    it('diz por que está indisponível, em vez de sumir', () => {
      expect(linkSimulationBlocker('PAID', 'OPEN')).toContain('não aceita nova tentativa');
      expect(linkSimulationBlocker('ACTIVE', 'PAID')).toContain('não está aberta');
      expect(linkSimulationBlocker('ACTIVE', 'OPEN')).toBeNull();
    });
  });
});

describe('estorno', () => {
  it('calcula o que ainda dá para estornar', () => {
    expect(refundableAmount(10000, 3000)).toBe(7000);
    expect(refundableAmount(10000)).toBe(10000);
    expect(refundableAmount(10000, 12000)).toBe(0);
  });

  it('aceita o estorno que cabe', () => {
    expect(
      refundBlocker({ status: 'CONFIRMED', amount: 10000, totalRefunded: 0, requested: 5000 }),
    ).toBeNull();
  });

  it('aceita estornar cobrança já liquidada', () => {
    expect(refundBlocker({ status: 'RELEASED', amount: 10000, requested: 10000 })).toBeNull();
  });

  it('recusa cobrança que não confirmou', () => {
    expect(refundBlocker({ status: 'PENDING', amount: 10000, requested: 100 })).toContain(
      'confirmada ou liquidada',
    );
  });

  it('olha o estornável restante, e não o status', () => {
    // Estorno parcial não muda o status: o pagamento segue CONFIRMED até o
    // estornado cobrir o total.
    const blocker = refundBlocker({
      status: 'CONFIRMED',
      amount: 10000,
      totalRefunded: 10000,
      requested: 100,
    });

    expect(blocker).toContain('já foi estornada por inteiro');
  });

  it('recusa valor zerado e valor acima do restante', () => {
    expect(refundBlocker({ status: 'CONFIRMED', amount: 10000, requested: 0 })).toContain(
      'maior que zero',
    );
    expect(
      refundBlocker({ status: 'CONFIRMED', amount: 10000, totalRefunded: 6000, requested: 5000 }),
    ).toContain('passa do que ainda dá');
  });
});
