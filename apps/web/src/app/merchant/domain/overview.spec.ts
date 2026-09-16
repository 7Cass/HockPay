import { attentionItems, originLabel, paymentSegments } from './overview';

const breakdown = [
  { status: 'CONFIRMED', count: 70 },
  { status: 'FAILED', count: 12 },
  { status: 'EXPIRED', count: 8 },
  { status: 'REFUNDED', count: 2 },
  { status: 'PENDING', count: 8 },
];

describe('faixas das tentativas de pagamento', () => {
  it('mede cada faixa contra o total de tentativas', () => {
    const segments = paymentSegments({ attempts: 100, approved: 70, breakdown });

    expect(segments.map((s) => [s.label, s.value, s.percent])).toEqual([
      ['Aprovadas', 70, 70],
      ['Falhas', 12, 12],
      ['Expiradas', 8, 8],
      ['Estornadas', 2, 2],
      ['Outros', 8, 8],
    ]);
  });

  it('a soma fecha a caixa', () => {
    const segments = paymentSegments({ attempts: 100, approved: 70, breakdown });
    const total = segments.reduce((sum, s) => sum + s.percent, 0);

    expect(total).toBeCloseTo(100);
  });

  it('"Outros" absorve o que os status nomeados não explicam', () => {
    // 40 tentativas, 10 aprovadas e nada mais na quebra: 30 continuam vivas.
    const segments = paymentSegments({ attempts: 40, approved: 10, breakdown: [] });

    expect(segments.map((s) => [s.label, s.value])).toEqual([
      ['Aprovadas', 10],
      ['Outros', 30],
    ]);
  });

  it('não deixa "Outros" ficar negativo quando a quebra passa do total', () => {
    const segments = paymentSegments({
      attempts: 10,
      approved: 8,
      breakdown: [{ status: 'FAILED', count: 9 }],
    });

    expect(segments.find((s) => s.label === 'Outros')).toBeUndefined();
  });

  it('esconde faixa vazia, que ocuparia legenda sem ocupar barra', () => {
    const segments = paymentSegments({
      attempts: 10,
      approved: 10,
      breakdown: [{ status: 'FAILED', count: 0 }],
    });

    expect(segments.map((s) => s.label)).toEqual(['Aprovadas']);
  });

  it('sem tentativa nenhuma, não há diagnóstico a mostrar', () => {
    expect(paymentSegments({ attempts: 0, approved: 0, breakdown })).toEqual([]);
  });

  it('a aprovada é verde e a falha é vermelha', () => {
    const segments = paymentSegments({ attempts: 100, approved: 70, breakdown });

    expect(segments.find((s) => s.label === 'Aprovadas')?.tone).toBe('ok');
    expect(segments.find((s) => s.label === 'Falhas')?.tone).toBe('bad');
    expect(segments.find((s) => s.label === 'Expiradas')?.tone).toBe('warn');
  });
});

describe('o que pede ação', () => {
  const nada = {
    failedWebhookDeliveries: 0,
    pendingWebhookDeliveries: 0,
    failedAlertDeliveries: 0,
    pendingAlertDeliveries: 0,
  };

  it('fica em silêncio quando não há nada a fazer', () => {
    expect(attentionItems(nada)).toEqual([]);
    expect(attentionItems(undefined)).toEqual([]);
  });

  it('lista só o que tem número, e leva à tela onde se conserta', () => {
    const items = attentionItems({ ...nada, failedWebhookDeliveries: 3 });

    expect(items).toHaveLength(1);
    expect(items[0].route).toBe('/dashboard/webhooks');
    expect(items[0].tone).toBe('bad');
  });

  it('fila é amarela, falha é vermelha', () => {
    const items = attentionItems({
      ...nada,
      pendingAlertDeliveries: 2,
      failedAlertDeliveries: 1,
    });

    expect(items.map((i) => [i.tone, i.value])).toEqual([
      ['bad', 1],
      ['warn', 2],
    ]);
  });
});

describe('origem de um pagamento', () => {
  it('traduz o que conhece', () => {
    expect(originLabel('payment_link')).toBe('Link');
    expect(originLabel('api')).toBe('API');
  });

  it('não devolve vazio para uma origem que não conhece', () => {
    expect(originLabel('carrier_pigeon')).toBe('Desconhecida');
  });
});
