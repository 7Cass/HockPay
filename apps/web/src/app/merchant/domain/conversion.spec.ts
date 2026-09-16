import { conversionPercent } from './conversion';

describe('conversão dos links', () => {
  it('lê a fração que a API manda, e não um percentual', () => {
    // 144 pagos de 189 links. Arredondar a fração direto mostrava "1%" — foi
    // o bug que a captura da fatia 4 entregou.
    expect(conversionPercent(144 / 189)).toBe('76%');
  });

  it('mostra uma casa decimal quando a conversão é baixa', () => {
    expect(conversionPercent(0.053)).toBe('5,3%');
    expect(conversionPercent(0.007)).toBe('0,7%');
  });

  it('arredonda sem casas quando já passou de dez por cento', () => {
    expect(conversionPercent(0.697)).toBe('70%');
    expect(conversionPercent(1)).toBe('100%');
  });

  it('trata zero, negativo e lixo como zero', () => {
    expect(conversionPercent(0)).toBe('0%');
    expect(conversionPercent(-1)).toBe('0%');
    expect(conversionPercent(Number.NaN)).toBe('0%');
  });
});
