import { DomainError } from './domain-error';

/**
 * Erro lançado quando se tenta executar uma operação inválida
 * para o estado atual do pagamento
 */
export class InvalidPaymentStateError extends DomainError {
  constructor(
    currentStatus: string,
    attemptedOperation: string,
    expectedStatuses?: string[]
  ) {
    const message = expectedStatuses
      ? `Cannot ${attemptedOperation} payment with status ${currentStatus}. Expected: ${expectedStatuses.join(', ')}`
      : `Cannot ${attemptedOperation} payment with status ${currentStatus}`;

    super(message, 'INVALID_PAYMENT_STATE', {
      currentStatus,
      attemptedOperation,
      expectedStatuses,
    });
  }
}

/**
 * Erro lançado quando um pagamento expirou
 */
export class PaymentExpiredError extends DomainError {
  constructor(expiresAt: Date) {
    super(
      `Payment expired at ${expiresAt.toISOString()}`,
      'PAYMENT_EXPIRED',
      { expiresAt: expiresAt.toISOString() }
    );
  }
}

/**
 * Erro lançado quando não há saldo suficiente para uma operação
 */
export class InsufficientFundsError extends DomainError {
  constructor(
    available: number,
    required: number,
    currency: string = 'BRL'
  ) {
    super(
      `Insufficient funds. Available: ${available / 100} ${currency}, Required: ${required / 100} ${currency}`,
      'INSUFFICIENT_FUNDS',
      { available, required, currency }
    );
  }
}

/**
 * Erro lançado quando um pagamento já foi confirmado
 */
export class PaymentAlreadyConfirmedError extends DomainError {
  constructor(paymentId: string, confirmedAt: Date) {
    super(
      `Payment ${paymentId} was already confirmed at ${confirmedAt.toISOString()}`,
      'PAYMENT_ALREADY_CONFIRMED',
      { paymentId, confirmedAt: confirmedAt.toISOString() }
    );
  }
}

/**
 * Erro lançado quando um pagamento não pode mais ser confirmado
 */
export class PaymentCannotBeConfirmedError extends DomainError {
  constructor(paymentId: string, status: string) {
    super(
      `Payment ${paymentId} cannot be confirmed. Current status: ${status}`,
      'PAYMENT_CANNOT_BE_CONFIRMED',
      { paymentId, status }
    );
  }
}

/**
 * Erro lançado quando um pagamento não pode mais ser expirado
 */
export class PaymentCannotBeExpiredError extends DomainError {
  constructor(paymentId: string, status: string) {
    super(
      `Payment ${paymentId} cannot be expired. Current status: ${status}`,
      'PAYMENT_CANNOT_BE_EXPIRED',
      { paymentId, status }
    );
  }
}

/**
 * Erro lançado quando uma loja não está aprovada para operar
 */
export class StoreNotApprovedError extends DomainError {
  constructor(storeId: string) {
    super(
      `Store ${storeId} is not approved to operate`,
      'STORE_NOT_APPROVED',
      { storeId }
    );
  }
}

/**
 * Erro lançado quando uma loja está inativa
 */
export class StoreInactiveError extends DomainError {
  constructor(storeId: string) {
    super(
      `Store ${storeId} is inactive`,
      'STORE_INACTIVE',
      { storeId }
    );
  }
}
