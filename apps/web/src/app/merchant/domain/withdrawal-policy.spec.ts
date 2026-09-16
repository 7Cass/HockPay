import {
  WITHDRAWAL_FEE,
  WITHDRAWAL_MAX,
  WITHDRAWAL_MIN,
  withdrawalBlocker,
  withdrawalCeiling,
  withdrawalNet,
} from './withdrawal-policy';

const ok = { amount: 25000, available: 100000, hasVerifiedAccount: true };

describe('política de saque', () => {
  it('libera o saque que cabe em tudo', () => {
    expect(withdrawalBlocker(ok)).toBeNull();
  });

  it('pede destino antes de olhar valor', () => {
    // Sem conta não há o que validar, e reclamar do valor primeiro mandaria o
    // lojista corrigir o campo errado.
    const blocker = withdrawalBlocker({ ...ok, hasVerifiedAccount: false, amount: 1 });

    expect(blocker).toContain('conta Pix verificada');
  });

  it('recusa abaixo do mínimo e acima do máximo, com o valor na frase', () => {
    // `toLocaleString` separa `R$` do número com espaço não separável (U+00A0),
    // e não com espaço comum — comparar a frase inteira falharia por um byte
    // invisível. O que importa aqui é o número estar na mensagem.
    expect(withdrawalBlocker({ ...ok, amount: WITHDRAWAL_MIN - 1 })).toContain('10,00');
    expect(withdrawalBlocker({ ...ok, amount: WITHDRAWAL_MAX + 1, available: 9999999 })).toContain(
      '5.000,00',
    );
  });

  it('recusa o que passa do saldo disponível', () => {
    expect(withdrawalBlocker({ ...ok, amount: 50000, available: 49999 })).toContain(
      'Saldo disponível insuficiente',
    );
  });

  it('recusa saque cujo líquido não sobraria', () => {
    // O mínimo (R$ 10) é maior que a taxa, então este caso só aparece se a
    // política mudar — e aí o teste avisa antes do lojista.
    expect(
      withdrawalBlocker({ amount: WITHDRAWAL_FEE, available: 100000, hasVerifiedAccount: true }),
    ).toBeTruthy();
  });

  describe('líquido', () => {
    it('desconta a taxa fixa', () => {
      expect(withdrawalNet(25000)).toBe(25000 - WITHDRAWAL_FEE);
    });

    it('nunca fica negativo', () => {
      expect(withdrawalNet(50)).toBe(0);
    });
  });

  describe('teto', () => {
    it('é o saldo, quando ele cabe no máximo', () => {
      expect(withdrawalCeiling(120000)).toBe(120000);
    });

    it('é o máximo, quando o saldo passa dele', () => {
      expect(withdrawalCeiling(900000)).toBe(WITHDRAWAL_MAX);
    });

    it('é zero quando nem o mínimo cabe — a tela desliga o botão', () => {
      expect(withdrawalCeiling(500)).toBe(0);
    });
  });
});
