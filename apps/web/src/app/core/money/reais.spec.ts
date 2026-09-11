import { centsToReaisText, parseReaisToCents } from './reais';

describe('parseReaisToCents', () => {
  it('reads whole reais', () => {
    expect(parseReaisToCents('10')).toBe(1000);
    expect(parseReaisToCents('0')).toBe(0);
  });

  it('reads the comma as the decimal separator, with one or two places', () => {
    expect(parseReaisToCents('10,5')).toBe(1050);
    expect(parseReaisToCents('10,50')).toBe(1050);
    expect(parseReaisToCents('0,01')).toBe(1);
  });

  it('converts by text, so no float rounding creeps in', () => {
    // 0.29 * 100 is 28.999999999999996 in floating point.
    expect(parseReaisToCents('0,29')).toBe(29);
    expect(parseReaisToCents('4.999,99')).toBe(499999);
  });

  it('reads thousands grouped by dots', () => {
    expect(parseReaisToCents('1.234,56')).toBe(123456);
    expect(parseReaisToCents('1.500')).toBe(150000);
    expect(parseReaisToCents('1.000.000,00')).toBe(100000000);
  });

  it('tolerates the currency sign and surrounding spaces', () => {
    expect(parseReaisToCents('R$ 1.234,56')).toBe(123456);
    expect(parseReaisToCents('  25,00  ')).toBe(2500);
  });

  it('refuses a dot as decimal instead of reading it as thousands', () => {
    // The parser this replaced turned this into R$ 1.050,00.
    expect(parseReaisToCents('10.50')).toBeNull();
    expect(parseReaisToCents('10.5')).toBeNull();
  });

  it('refuses what it would have to guess', () => {
    expect(parseReaisToCents('')).toBeNull();
    expect(parseReaisToCents('1,234')).toBeNull();
    expect(parseReaisToCents('12.34.567')).toBeNull();
    expect(parseReaisToCents('-10')).toBeNull();
    expect(parseReaisToCents('10,')).toBeNull();
    expect(parseReaisToCents('dez')).toBeNull();
  });
});

describe('centsToReaisText', () => {
  it('writes cents the way the parser reads them back', () => {
    for (const cents of [0, 1, 29, 1000, 4801, 123456, 500000]) {
      expect(parseReaisToCents(centsToReaisText(cents))).toBe(cents);
    }
  });

  it('keeps two places and no thousands dot', () => {
    expect(centsToReaisText(123456)).toBe('1234,56');
    expect(centsToReaisText(5)).toBe('0,05');
  });
});
