import { readListParams, writeListParams } from './list-params';

const DEFAULTS = { q: '', status: '', page: 1, limit: 20 } as const;

function urlWith(params: Record<string, string>) {
  return (key: string) => params[key] ?? null;
}

describe('parâmetros de lista', () => {
  describe('leitura', () => {
    it('devolve os padrões quando a URL está vazia', () => {
      expect(readListParams(DEFAULTS, urlWith({}))).toEqual(DEFAULTS);
    });

    it('lê o que a URL traz, respeitando o tipo do padrão', () => {
      const read = readListParams(DEFAULTS, urlWith({ q: 'FIG-1', status: 'PAID', page: '3' }));

      expect(read).toEqual({ q: 'FIG-1', status: 'PAID', page: 3, limit: 20 });
    });

    it('recusa número inválido em vez de virar NaN', () => {
      // É o achado aberto das rotas da mesa (`?limit=abc` -> NaN). A tela do
      // lojista não repete: valor que não é número cai no padrão.
      const read = readListParams(DEFAULTS, urlWith({ page: 'abc', limit: '' }));

      expect(read.page).toBe(1);
      expect(read.limit).toBe(20);
    });

    it('trata parâmetro vazio como ausente', () => {
      expect(readListParams(DEFAULTS, urlWith({ q: '' })).q).toBe('');
    });

    it('ignora o que não está nos padrões', () => {
      const read = readListParams(DEFAULTS, urlWith({ intruso: 'x' }));

      expect(read).not.toHaveProperty('intruso');
    });
  });

  describe('escrita', () => {
    it('apaga da URL tudo que é igual ao padrão', () => {
      expect(writeListParams(DEFAULTS, DEFAULTS)).toEqual({
        q: null,
        status: null,
        page: null,
        limit: null,
      });
    });

    it('escreve só o que foi escolhido', () => {
      const written = writeListParams(DEFAULTS, { q: 'FIG-1', status: '', page: 2, limit: 20 });

      expect(written).toEqual({ q: 'FIG-1', status: null, page: '2', limit: null });
    });

    it('vai e volta sem perder nada', () => {
      const chosen = { q: 'ana', status: 'CONFIRMED', page: 4, limit: 50 };
      const written = writeListParams(DEFAULTS, chosen);
      const url = Object.fromEntries(
        Object.entries(written).filter(([, value]) => value !== null),
      ) as Record<string, string>;

      expect(readListParams(DEFAULTS, (key) => url[key] ?? null)).toEqual(chosen);
    });
  });
});
