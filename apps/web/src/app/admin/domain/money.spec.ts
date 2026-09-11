import { formatCents, parseReaisToCents } from './money';

// O parser é testado onde mora, em `core/money/reais.spec.ts`. Aqui fica só o
// que é da mesa, e a garantia de que ela recebe o parser estrito, e não outro.
describe('admin money', () => {
  it('hands the desk the strict parser', () => {
    expect(parseReaisToCents('1.234,56')).toBe(123456);
    expect(parseReaisToCents('10.50')).toBeNull();
  });

  it('writes cents as reais for sentences built in code', () => {
    // O espaço entre símbolo e número é não separável no Intl.
    expect(formatCents(123456).replace(/\s/g, ' ')).toBe('R$ 1.234,56');
  });
});
