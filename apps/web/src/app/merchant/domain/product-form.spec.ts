import {
  EMPTY_DRAFT,
  draftPrice,
  parseMetadata,
  productBlocker,
  productPayload,
} from './product-form';

const draft = { ...EMPTY_DRAFT, name: 'Curso de Pix', price: '49,90' };

describe('metadata digitado à mão', () => {
  it('vazio é ausência, e não objeto vazio', () => {
    // `{}` apagaria o metadata que já estava gravado.
    expect(parseMetadata('   ')).toEqual({ ok: true, value: undefined });
  });

  it('aceita um objeto', () => {
    expect(parseMetadata('{"pedido": "123"}')).toEqual({ ok: true, value: { pedido: '123' } });
  });

  it('recusa JSON quebrado', () => {
    const result = parseMetadata('{pedido: 123}');
    expect(result.ok).toBe(false);
  });

  it('recusa lista, que entraria como mapa de índices', () => {
    const result = parseMetadata('[1, 2]');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain('objeto');
  });

  it('recusa um número solto', () => {
    expect(parseMetadata('42').ok).toBe(false);
  });
});

describe('preço em reais', () => {
  it('lê a vírgula como decimal', () => {
    expect(draftPrice({ ...draft, price: '49,90' })).toBe(4990);
  });

  it('recusa o ponto decimal, que num campo em reais é milhar', () => {
    // Aceitar `10.50` como dez e cinquenta vira cobrança de mil e quinhentos.
    expect(productBlocker({ ...draft, price: '10.50' })).toContain('preço');
  });
});

describe('o que impede de salvar um produto', () => {
  it('deixa passar o que está completo', () => {
    expect(productBlocker(draft)).toBeNull();
  });

  it('cobra o nome', () => {
    expect(productBlocker({ ...draft, name: '  ' })).toContain('nome');
  });

  it('cobra um preço que valha alguma coisa', () => {
    expect(productBlocker({ ...draft, price: '' })).toContain('preço');
    expect(productBlocker({ ...draft, price: '0,00' })).toContain('preço');
  });

  it('recusa uma imagem que não é endereço', () => {
    expect(productBlocker({ ...draft, imageUrl: 'foto.png' })).toContain('http');
  });

  it('aceita imagem com http e com https', () => {
    expect(productBlocker({ ...draft, imageUrl: 'https://loja.com/a.png' })).toBeNull();
    expect(productBlocker({ ...draft, imageUrl: 'http://loja.com/a.png' })).toBeNull();
  });

  it('reclama do metadata antes de mandar', () => {
    expect(productBlocker({ ...draft, metadata: 'nada disso' })).toContain('JSON');
  });
});

describe('o corpo que vai para a API', () => {
  it('manda o essencial e omite o que ficou em branco', () => {
    expect(productPayload(draft)).toEqual({ name: 'Curso de Pix', price: 4990 });
  });

  it('inclui o que foi preenchido, sem espaço em volta', () => {
    expect(
      productPayload({
        ...draft,
        externalId: '  SKU-1 ',
        description: ' Aulas ',
        imageUrl: ' https://loja.com/a.png ',
        metadata: '{"turma": 3}',
      }),
    ).toEqual({
      name: 'Curso de Pix',
      price: 4990,
      externalId: 'SKU-1',
      description: 'Aulas',
      imageUrl: 'https://loja.com/a.png',
      metadata: { turma: 3 },
    });
  });

  it('não manda campo vazio como string vazia', () => {
    const payload = productPayload(draft);
    expect(Object.keys(payload)).not.toContain('description');
    expect(Object.keys(payload)).not.toContain('metadata');
  });
});
