import {
  canRequestLive,
  feeLine,
  liveLabel,
  liveNote,
  liveTone,
  settlementLine,
} from './live-status';

describe('estado da habilitação LIVE', () => {
  it('todo estado tem rótulo, frase e tom', () => {
    for (const status of [
      'NOT_REQUESTED',
      'PENDING',
      'APPROVED',
      'REJECTED',
      'SUSPENDED',
    ] as const) {
      expect(liveLabel(status)).toBeTruthy();
      expect(liveNote(status).length).toBeGreaterThan(20);
      expect(liveTone(status)).toBeTruthy();
    }
  });

  it('avisa que LIVE também é simulado antes de alguém pedir', () => {
    expect(liveNote('NOT_REQUESTED')).toContain('simulado');
    expect(liveNote('APPROVED')).toContain('simulado');
  });

  it('em análise é espera, não erro', () => {
    expect(liveTone('PENDING')).toBe('warn');
    expect(liveTone('APPROVED')).toBe('ok');
    expect(liveTone('SUSPENDED')).toBe('bad');
  });

  it('não quebra com um estado que ainda não conhece', () => {
    const desconhecido = 'ALIENIGENA' as never;
    expect(liveLabel(desconhecido)).toBe('LIVE não solicitado');
    expect(liveTone(desconhecido)).toBe('neutral');
  });
});

describe('quem pode pedir habilitação', () => {
  it('quem nunca pediu, e quem foi recusado', () => {
    expect(canRequestLive('NOT_REQUESTED')).toBe(true);
    expect(canRequestLive('REJECTED')).toBe(true);
  });

  it('quem já está na fila, já foi aprovado ou foi suspenso, não', () => {
    // Um botão que existe para ser recusado é pior do que botão nenhum.
    expect(canRequestLive('PENDING')).toBe(false);
    expect(canRequestLive('APPROVED')).toBe(false);
    expect(canRequestLive('SUSPENDED')).toBe(false);
  });
});

describe('condições comerciais em uma linha', () => {
  it('junta percentual e fixo', () => {
    expect(feeLine(1.99, 49)).toContain('1,99%');
    expect(feeLine(1.99, 49)).toContain('0,49');
  });

  it('mantém as duas casas do percentual', () => {
    expect(feeLine(2, 0)).toContain('2,00%');
  });

  it('diz a liquidação em palavras', () => {
    expect(settlementLine(0)).toBe('No mesmo dia');
    expect(settlementLine(1)).toBe('Em 1 dia');
    expect(settlementLine(30)).toBe('Em 30 dias');
  });
});
