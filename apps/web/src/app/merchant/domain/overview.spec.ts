import { attentionItems, linkFunnel, moneyFlow, originLabel, paymentSegments } from './overview';

const breakdown = [
  { status: 'CONFIRMED', count: 70, amount: 700_00 },
  { status: 'FAILED', count: 12, amount: 120_00 },
  { status: 'EXPIRED', count: 8, amount: 80_00 },
  { status: 'REFUNDED', count: 2, amount: 20_00 },
  { status: 'PENDING', count: 8, amount: 80_00 },
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

  it('carrega o valor de cada faixa, e não só a contagem', () => {
    // "25 expiradas" nao diz nada; "25 expiradas, R$ 4.521,90" diz quanto
    // dinheiro deixou de entrar.
    const segments = paymentSegments({ attempts: 100, approved: 70, breakdown });

    expect(segments.find((s) => s.label === 'Expiradas')?.amount).toBe(80_00);
    expect(segments.find((s) => s.label === 'Aprovadas')?.amount).toBe(700_00);
  });

  it('soma CONFIRMED e RELEASED no valor aprovado', () => {
    const segments = paymentSegments({
      attempts: 10,
      approved: 6,
      breakdown: [
        { status: 'CONFIRMED', count: 4, amount: 400_00 },
        { status: 'RELEASED', count: 2, amount: 200_00 },
      ],
    });

    expect(segments.find((s) => s.label === 'Aprovadas')?.amount).toBe(600_00);
  });

  it('um valor aprovado informado de fora ganha da soma da quebra', () => {
    const segments = paymentSegments({
      attempts: 10,
      approved: 6,
      approvedAmount: 999_00,
      breakdown,
    });

    expect(segments.find((s) => s.label === 'Aprovadas')?.amount).toBe(999_00);
  });

  it('aguenta uma quebra sem valor nenhum', () => {
    const segments = paymentSegments({
      attempts: 10,
      approved: 4,
      breakdown: [{ status: 'FAILED', count: 2 }],
    });

    expect(segments.find((s) => s.label === 'Falhas')?.amount).toBe(0);
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

describe('o funil de um link', () => {
  it('mede cada passo contra os criados', () => {
    const steps = linkFunnel({ linksCreated: 30, linksOpened: 24, linksPaid: 21 });

    expect(steps.map((s) => [s.label, s.value, Math.round(s.percent)])).toEqual([
      ['Criados', 30, 100],
      ['Abertos', 24, 80],
      ['Pagos', 21, 70],
    ]);
  });

  it('diz quanto sobrou de um passo para o outro — é onde se perde', () => {
    const steps = linkFunnel({ linksCreated: 30, linksOpened: 24, linksPaid: 21 });

    expect(steps[1].fromPrevious).toBeCloseTo(0.8);
    expect(steps[2].fromPrevious).toBeCloseTo(0.875);
  });

  it('o primeiro passo não tem de onde ter vindo', () => {
    expect(
      linkFunnel({ linksCreated: 5, linksOpened: 5, linksPaid: 5 })[0].fromPrevious,
    ).toBeNull();
  });

  it('omite "Abertos" quando a API nao alimenta o campo', () => {
    // Medido na API em 2026-09-16: `linksOpened` volta 0 com 21 links pagos na
    // mesma resposta. Nao da para pagar um link sem abrir, entao zero ali e
    // campo vazio, e nao "ninguem abriu".
    const steps = linkFunnel({ linksCreated: 30, linksOpened: 0, linksPaid: 21 });

    expect(steps.map((s) => s.label)).toEqual(['Criados', 'Pagos']);
    expect(steps[1].fromPrevious).toBeCloseTo(0.7);
  });

  it('mas mostra "Abertos" com zero quando tambem nao houve pagamento', () => {
    // Aqui o zero e informacao de verdade: criaram, ninguem abriu, ninguem pagou.
    const steps = linkFunnel({ linksCreated: 4, linksOpened: 0, linksPaid: 0 });

    expect(steps.map((s) => s.label)).toEqual(['Criados', 'Abertos', 'Pagos']);
  });

  it('não desenha um funil que engorda', () => {
    // A API devolve mais abertos do que criados quando um link nascido antes da
    // janela e aberto dentro dela. O numero segue verdadeiro; a barra e presa.
    const steps = linkFunnel({ linksCreated: 10, linksOpened: 14, linksPaid: 9 });

    expect(steps[1].value).toBe(14);
    expect(steps[1].percent).toBe(100);
  });

  it('sem link criado, não há funil', () => {
    expect(linkFunnel({ linksCreated: 0, linksOpened: 0, linksPaid: 0 })).toEqual([]);
  });
});

describe('a conta do período', () => {
  it('separa bruto, taxa e líquido', () => {
    const flow = moneyFlow({ grossVolume: 1000_00, feeVolume: 20_00, netVolume: 980_00 });

    expect(flow.gross).toBe(1000_00);
    expect(flow.fees).toBe(20_00);
    expect(flow.net).toBe(980_00);
    expect(flow.feesDerived).toBe(false);
  });

  it('deriva a taxa quando o campo vem zerado e a conta nao fecha', () => {
    // Medido na API em 2026-09-16: `feeVolume` volta 0 com bruto 33.788,50 e
    // liquido 33.256,74. "Taxas R$ 0,00" ao lado disso e numero errado sobre
    // dinheiro; a diferenca **e** a taxa, por definicao.
    const flow = moneyFlow({ grossVolume: 3378850, feeVolume: 0, netVolume: 3325674 });

    expect(flow.fees).toBe(53176);
    expect(flow.feesDerived).toBe(true);
  });

  it('a conta sempre fecha', () => {
    const flow = moneyFlow({ grossVolume: 3378850, feeVolume: 0, netVolume: 3325674 });
    expect(flow.gross - flow.fees).toBe(flow.net);
  });

  it('nao inventa taxa negativa quando o liquido passa do bruto', () => {
    const flow = moneyFlow({ grossVolume: 100_00, feeVolume: 0, netVolume: 120_00 });
    expect(flow.fees).toBe(0);
    expect(flow.feesDerived).toBe(false);
  });

  it('diz quanto da receita virou taxa', () => {
    const flow = moneyFlow({ grossVolume: 1000_00, feeVolume: 25_00, netVolume: 975_00 });
    expect(flow.feeShare).toBeCloseTo(0.025);
  });

  it('não divide por zero num período sem receita', () => {
    const flow = moneyFlow({ grossVolume: 0, feeVolume: 0, netVolume: 0 });
    expect(flow.feeShare).toBe(0);
    expect(flow.feesDerived).toBe(false);
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
