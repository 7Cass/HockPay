/**
 * A política de saque, como a tela precisa dela.
 *
 * **A tela avisa; quem decide é a API.** Esta cópia existe para o lojista saber
 * antes de clicar por que o botão está desligado — não para substituir a regra
 * do backend. Quando os dois divergirem, a mensagem que vale é a da API, e a
 * tela mostra a dela.
 *
 * É achado aberto conhecido que a política mora em três lugares (core, painel
 * do lojista e mesa). Este arquivo não resolve isso; ele ao menos junta num
 * ponto só o que estava espalhado pelo componente de saque — e, sendo domínio
 * puro, cada regra tem teste.
 */
export const WITHDRAWAL_FEE = 199;
export const WITHDRAWAL_MIN = 1000;
export const WITHDRAWAL_MAX = 500000;

export interface WithdrawalIntent {
  /** Em centavos, já lido pelo parser estrito de reais. */
  readonly amount: number;
  readonly available: number;
  readonly hasVerifiedAccount: boolean;
}

/**
 * O que impede este saque, em português, ou `null` quando nada impede.
 *
 * A ordem das perguntas é a ordem em que elas ajudam: destino antes de valor
 * (sem conta não há o que validar), mínimo antes de máximo, e saldo por
 * último — é o que muda sozinho enquanto a tela está aberta.
 */
export function withdrawalBlocker(intent: WithdrawalIntent): string | null {
  if (!intent.hasVerifiedAccount) {
    return 'Selecione uma conta Pix verificada para receber o saque.';
  }
  if (intent.amount < WITHDRAWAL_MIN) {
    return `O valor mínimo para saque é ${money(WITHDRAWAL_MIN)}.`;
  }
  if (intent.amount > WITHDRAWAL_MAX) {
    return `O valor máximo para saque é ${money(WITHDRAWAL_MAX)}.`;
  }
  if (intent.amount > intent.available) {
    return 'Saldo disponível insuficiente para esse saque.';
  }
  if (intent.amount <= WITHDRAWAL_FEE) {
    return 'O valor líquido precisa ser maior que zero.';
  }

  return null;
}

/** O que chega do outro lado, depois da taxa fixa. */
export function withdrawalNet(amount: number): number {
  return Math.max(amount - WITHDRAWAL_FEE, 0);
}

/**
 * O maior saque possível agora: o que o saldo permite, limitado pelo teto.
 * Devolve `0` quando nem o mínimo cabe — a tela desliga o botão em vez de
 * oferecer um valor que ela mesma vai recusar.
 */
export function withdrawalCeiling(available: number): number {
  const ceiling = Math.min(available, WITHDRAWAL_MAX);
  return ceiling >= WITHDRAWAL_MIN ? ceiling : 0;
}

function money(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
