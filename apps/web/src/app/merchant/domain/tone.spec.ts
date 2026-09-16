import { statusLabel, statusTone } from './tone';

describe('vocabulário de estado do console', () => {
  it('lê os três desfechos de uma cobrança', () => {
    expect(statusTone('CONFIRMED')).toBe('ok');
    expect(statusTone('RELEASED')).toBe('ok');
    expect(statusTone('PENDING')).toBe('warn');
    expect(statusTone('FAILED')).toBe('bad');
    expect(statusTone('EXPIRED')).toBe('bad');
  });

  it('trata estorno como desfecho ruim, e não como conclusão', () => {
    // O dinheiro voltou: para o lojista, é o oposto de uma venda.
    expect(statusTone('REFUNDED')).toBe('bad');
  });

  it('não conhece o tom `info` da mesa', () => {
    const tones = ['CONFIRMED', 'PENDING', 'FAILED', 'QUALQUER_COISA'].map(statusTone);
    expect(tones).not.toContain('info');
  });

  it('cai em neutro no status que não conhece', () => {
    expect(statusTone('ALGO_NOVO')).toBe('neutral');
    expect(statusTone('')).toBe('neutral');
  });

  it('é indiferente a caixa', () => {
    expect(statusTone('confirmed')).toBe('ok');
    expect(statusLabel('confirmed')).toBe('Confirmado');
  });

  it('devolve o próprio status quando não tem tradução', () => {
    expect(statusLabel('ALGO_NOVO')).toBe('ALGO_NOVO');
  });
});
