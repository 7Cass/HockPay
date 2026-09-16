import {
  addDays,
  endOfDayIso,
  startOfDayIso,
  parseLocalDate,
  periodCaption,
  rangeBlocker,
  rangeFor,
  shortDate,
  toInputDate,
} from './period';

/** Uma quarta-feira, para os atalhos não dependerem de quando o teste roda. */
const HOJE = new Date(2026, 8, 16); // 16/09/2026, hora local

describe('a data da URL no fuso de quem olha', () => {
  it('não anda um dia para trás', () => {
    // `new Date('2026-09-16')` seria meia-noite UTC — 21h do dia 15 no Brasil.
    const date = parseLocalDate('2026-09-16');

    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(8);
    expect(date?.getDate()).toBe(16);
  });

  it('ida e volta não muda o dia', () => {
    expect(toInputDate(parseLocalDate('2026-01-31')!)).toBe('2026-01-31');
  });

  it('recusa data que não existe em vez de escorregar para o mês seguinte', () => {
    // `new Date(2026, 1, 31)` vira 3 de março sem reclamar.
    expect(parseLocalDate('2026-02-31')).toBeNull();
  });

  it('recusa lixo', () => {
    expect(parseLocalDate('ontem')).toBeNull();
    expect(parseLocalDate('')).toBeNull();
    expect(parseLocalDate('16/09/2026')).toBeNull();
  });
});

describe('atalhos de período', () => {
  it('hoje é um dia só', () => {
    expect(rangeFor('today', { startDate: '', endDate: '' }, HOJE)).toEqual({
      startDate: '2026-09-16',
      endDate: '2026-09-16',
    });
  });

  it('sete dias conta hoje, e não hoje mais sete', () => {
    expect(rangeFor('7d', { startDate: '', endDate: '' }, HOJE)).toEqual({
      startDate: '2026-09-10',
      endDate: '2026-09-16',
    });
  });

  it('trinta dias também', () => {
    expect(rangeFor('30d', { startDate: '', endDate: '' }, HOJE)).toEqual({
      startDate: '2026-08-18',
      endDate: '2026-09-16',
    });
  });

  it('o intervalo escolhido ganha do atalho', () => {
    const custom = { startDate: '2026-03-01', endDate: '2026-03-31' };
    expect(rangeFor('custom', custom, HOJE)).toEqual(custom);
  });

  it('intervalo pela metade cai no padrão em vez de pedir período vazio', () => {
    expect(rangeFor('custom', { startDate: '2026-03-01', endDate: '' }, HOJE)).toEqual({
      startDate: '2026-08-18',
      endDate: '2026-09-16',
    });
  });

  it('atravessa a virada do mês', () => {
    expect(rangeFor('7d', { startDate: '', endDate: '' }, new Date(2026, 2, 3))).toEqual({
      startDate: '2026-02-25',
      endDate: '2026-03-03',
    });
  });

  it('soma dias sem estragar o original', () => {
    const base = new Date(2026, 8, 16);
    addDays(base, -30);
    expect(base.getDate()).toBe(16);
  });
});

describe('limites do dia', () => {
  it('o começo do dia é meia-noite local, e o fim é o último milissegundo', () => {
    const start = new Date(startOfDayIso('2026-09-16'));
    const end = new Date(endOfDayIso('2026-09-16'));

    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end.getMilliseconds()).toBe(999);
  });

  it('o dia inteiro cabe entre os dois', () => {
    const start = new Date(startOfDayIso('2026-09-16')).getTime();
    const end = new Date(endOfDayIso('2026-09-16')).getTime();

    expect(end - start).toBe(86_400_000 - 1);
  });
});

describe('como o período se apresenta', () => {
  it('o atalho tem nome', () => {
    const range = { startDate: '2026-09-10', endDate: '2026-09-16' };
    expect(periodCaption('7d', range)).toBe('Últimos 7 dias');
    expect(periodCaption('today', range)).toBe('Hoje');
  });

  it('o intervalo escolhido mostra as pontas', () => {
    expect(periodCaption('custom', { startDate: '2026-03-01', endDate: '2026-03-31' })).toBe(
      '01/03 a 31/03',
    );
  });

  it('a data curta não vira "Invalid Date"', () => {
    expect(shortDate('nada disso')).toBe('nada disso');
  });
});

describe('o que impede de pedir o intervalo', () => {
  it('deixa passar um intervalo válido', () => {
    expect(rangeBlocker({ startDate: '2026-03-01', endDate: '2026-03-31' })).toBeNull();
  });

  it('avisa quando o fim vem antes do começo', () => {
    // A API devolveria período vazio, e a tela diria "sem atividade" — o
    // lojista concluiria que não vendeu nada.
    expect(rangeBlocker({ startDate: '2026-03-31', endDate: '2026-03-01' })).toContain('anterior');
  });

  it('cobra as duas pontas', () => {
    expect(rangeBlocker({ startDate: '2026-03-01', endDate: '' })).toContain('data');
  });
});
