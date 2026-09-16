import { deltaLabel, deltaTone, ratePercent } from './deltas';

describe('variação contra o período anterior', () => {
  it('lê a fração que a API manda, e não um percentual', () => {
    // A mesma armadilha que pôs "1%" na tela dos links na fatia 4.
    expect(deltaLabel(0.12)).toBe('+12%');
    expect(deltaLabel(-0.34)).toBe('−34%');
  });

  it('mostra uma casa decimal só quando a variação é pequena', () => {
    expect(deltaLabel(0.053)).toBe('+5,3%');
    expect(deltaLabel(0.128)).toBe('+13%');
  });

  it('distingue "não mudou" de "mudou pouco demais para arredondar"', () => {
    expect(deltaLabel(0)).toBe('0%');
    expect(deltaLabel(0.0002)).toBe('≈0%');
  });

  it('devolve nulo quando não há período anterior comparável', () => {
    // Zero mentiria dizendo que ficou igual.
    expect(deltaLabel(null)).toBeNull();
    expect(deltaLabel(undefined)).toBeNull();
    expect(deltaLabel(Number.NaN)).toBeNull();
  });

  it('usa o sinal de menos de verdade, e não o hífen', () => {
    expect(deltaLabel(-0.5)?.startsWith('−')).toBe(true);
  });
});

describe('tom da variação', () => {
  it('subir é bom, descer é ruim', () => {
    expect(deltaTone(0.1)).toBe('ok');
    expect(deltaTone(-0.1)).toBe('bad');
  });

  it('não pinta o que não mudou nem o que não tem comparativo', () => {
    expect(deltaTone(0)).toBeNull();
    expect(deltaTone(null)).toBeNull();
  });

  it('inverte quando subir é ruim', () => {
    expect(deltaTone(0.1, true)).toBe('bad');
    expect(deltaTone(-0.1, true)).toBe('ok');
  });
});

describe('taxa como largura de barra', () => {
  it('vira percentual', () => {
    expect(ratePercent(0.76)).toBeCloseTo(76);
  });

  it('não deixa a barra passar da caixa nem ficar negativa', () => {
    // O backend pode devolver mais pagos do que criados na janela, quando um
    // link criado antes dela é pago dentro.
    expect(ratePercent(1.2)).toBe(100);
    expect(ratePercent(-0.3)).toBe(0);
  });

  it('trata ausência como zero', () => {
    expect(ratePercent(null)).toBe(0);
    expect(ratePercent(Number.NaN)).toBe(0);
  });
});
