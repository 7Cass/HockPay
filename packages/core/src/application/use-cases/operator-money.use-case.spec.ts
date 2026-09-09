import { describe, expect, it, vi } from 'vitest';
import { OperatorCreateWithdrawalUseCase } from './operator-create-withdrawal.use-case';
import { OperatorCreateRefundUseCase } from './operator-create-refund.use-case';
import { CreateWithdrawalUseCase } from './create-withdrawal.use-case';
import { CreateRefundUseCase } from './create-refund.use-case';
import { Account } from '../../domain/entities/account.entity';
import { BankAccount, PixKeyType } from '../../domain/entities/bank-account.entity';
import { Payment } from '../../domain/entities/payment.entity';
import { Store } from '../../domain/entities/store.entity';
import { OperatorAuditLog } from '../../domain/entities/operator-audit-log.entity';
import { OperatorDecisionReasonRequiredError } from '../../domain/errors/operator-decision-reason-required.error';
import { LiveEnvironmentNotAllowedError } from '../../domain/errors/live-environment-not-allowed.error';
import { StoreLiveStatus } from '../../domain/value-objects/store-live-status.vo';
import { Environment } from '../../domain/value-objects/environment.vo';

/**
 * A mesa movendo dinheiro pela loja.
 *
 * O que estes testes protegem nao e o movimento -- esse ja e testado onde ele
 * mora, no use case do lojista -- e sim o que faz dele uma acao da mesa: o
 * motivo obrigatorio, a trilha escrita na mesma transacao, e o fato de que a
 * loja fechada nao impede a mesa. Uma loja suspensa e o caso inteiro: se ela
 * passasse aqui pelo gate, a metade que destranca a porta nao existiria.
 */
function suspendedStore(): Store {
  return Store.reconstitute({
    id: 'store-1',
    merchantId: 'merchant-1',
    name: 'Ateliê Corvo',
    slug: 'atelie-corvo',
    isActive: true,
    liveStatus: StoreLiveStatus.SUSPENDED,
    settlementDays: 1,
    feePercent: 1.5,
    feeFixed: 15,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('a mesa saca pela loja', () => {
  function makeFixture() {
    const store = suspendedStore();
    const account = Account.reconstitute({
      id: 'account-1',
      storeId: store.id,
      available: 100_000,
      pending: 0,
      blocked: 0,
      currency: 'BRL',
      updatedAt: new Date(),
    });
    const bankAccount = BankAccount.reconstitute({
      id: 'bank-1',
      storeId: store.id,
      pixKey: '12345678901',
      pixKeyType: PixKeyType.CPF,
      holderName: 'Merchant',
      holderDocument: '12345678901',
      isDefault: true,
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const trail: OperatorAuditLog[] = [];

    const repos = {
      storeRepository: { findById: vi.fn(async () => store) },
      accountRepository: {
        findByStoreIdAndEnvironment: vi.fn(async () => account),
        findByStoreIdAndEnvironmentForUpdate: vi.fn(async () => account),
        update: vi.fn(),
      },
      bankAccountRepository: { findById: vi.fn(async () => bankAccount) },
      withdrawalRepository: {
        save: vi.fn(),
        sumAmountCreatedInRange: vi.fn(async () => 0),
        countCreatedInRange: vi.fn(async () => 0),
      },
      transactionRepository: { save: vi.fn() },
      outboxWriter: { save: vi.fn() },
      operatorAuditLogRepository: {
        append: vi.fn(async (log: OperatorAuditLog) => {
          trail.push(log);
        }),
      },
    };

    const unitOfWork = { execute: async (work: any) => work(repos) } as any;

    return {
      account,
      trail,
      repos,
      useCase: new OperatorCreateWithdrawalUseCase(
        unitOfWork,
        new CreateWithdrawalUseCase(unitOfWork),
      ),
    };
  }

  const input = {
    operatorId: 'operator-1',
    storeId: 'store-1',
    bankAccountId: 'bank-1',
    amount: 10_000,
    environment: Environment.LIVE,
    reason: 'chamado #412 -- lojista suspenso pediu o saldo',
    requestId: 'req-1',
  };

  it('saca em LIVE por uma loja suspensa, que nao pode sacar sozinha', async () => {
    const fixture = makeFixture();

    const result = await fixture.useCase.execute(input);

    expect(result.withdrawal.amount).toBe(10_000);
    expect(result.account.blocked).toBe(10_000);
    expect(result.account.available).toBe(90_000);
  });

  it('escreve a trilha com o saldo dos dois lados', async () => {
    const fixture = makeFixture();

    await fixture.useCase.execute(input);

    expect(fixture.trail).toHaveLength(1);
    const line = fixture.trail[0].toObject();
    expect(line.action).toBe('store.withdrawal_created');
    expect(line.operatorId).toBe('operator-1');
    expect(line.targetType).toBe('store');
    expect(line.targetId).toBe('store-1');
    expect(line.reason).toBe('chamado #412 -- lojista suspenso pediu o saldo');
    expect(line.requestId).toBe('req-1');
    expect(line.before).toMatchObject({ available: 100_000, blocked: 0 });
    expect(line.after).toMatchObject({
      available: 90_000,
      blocked: 10_000,
      amount: 10_000,
      environment: Environment.LIVE,
      bankAccountId: 'bank-1',
    });
  });

  it('exige motivo, e nao move nada sem ele', async () => {
    const fixture = makeFixture();

    await expect(fixture.useCase.execute({ ...input, reason: '   ' })).rejects.toBeInstanceOf(
      OperatorDecisionReasonRequiredError,
    );

    expect(fixture.repos.withdrawalRepository.save).not.toHaveBeenCalled();
    expect(fixture.trail).toHaveLength(0);
  });

  it('le o saldo do "antes" travado, e nao pela leitura solta', async () => {
    const fixture = makeFixture();

    await fixture.useCase.execute(input);

    expect(fixture.repos.accountRepository.findByStoreIdAndEnvironmentForUpdate).toHaveBeenCalled();
    expect(fixture.repos.accountRepository.findByStoreIdAndEnvironment).not.toHaveBeenCalled();
  });
});

describe('a mesa estorna pela loja', () => {
  function makeFixture(paymentEnvironment: Environment = Environment.LIVE) {
    const store = suspendedStore();
    const payment = Payment.create({
      storeId: store.id,
      amount: 10_000,
      fee: 1_000,
      netAmount: 9_000,
      environment: paymentEnvironment,
      expiresAt: new Date(Date.now() + 60_000),
    });
    payment.confirm();

    const account = Account.reconstitute({
      id: 'account-1',
      storeId: store.id,
      available: 0,
      pending: 9_000,
      blocked: 0,
      currency: 'BRL',
      updatedAt: new Date(),
    });
    const trail: OperatorAuditLog[] = [];

    const repos = {
      storeRepository: { findById: vi.fn(async () => store) },
      paymentRepository: {
        findByIdAndStoreId: vi.fn(async () => payment),
        findByIdAndStoreIdForUpdate: vi.fn(async () => payment),
        update: vi.fn(),
      },
      refundRepository: { save: vi.fn() },
      accountRepository: {
        findByStoreIdAndEnvironmentForUpdate: vi.fn(async () => account),
        update: vi.fn(),
      },
      transactionRepository: { save: vi.fn() },
      outboxWriter: { save: vi.fn() },
      operatorAuditLogRepository: {
        append: vi.fn(async (log: OperatorAuditLog) => {
          trail.push(log);
        }),
      },
    };

    const unitOfWork = { execute: async (work: any) => work(repos) } as any;

    return {
      payment,
      trail,
      repos,
      useCase: new OperatorCreateRefundUseCase(unitOfWork, new CreateRefundUseCase(unitOfWork)),
    };
  }

  it('estorna em LIVE por uma loja suspensa, e escreve a trilha', async () => {
    const fixture = makeFixture();

    const result = await fixture.useCase.execute({
      operatorId: 'operator-1',
      storeId: 'store-1',
      paymentId: fixture.payment.id,
      amount: 2_500,
      environment: Environment.LIVE,
      reason: 'chamado #413 -- comprador pediu estorno',
    });

    expect(result.refund.amount).toBe(2_500);
    expect(result.payment.totalRefunded).toBe(2_500);

    expect(fixture.trail).toHaveLength(1);
    const line = fixture.trail[0].toObject();
    expect(line.action).toBe('store.refund_created');
    expect(line.targetType).toBe('store');
    expect(line.targetId).toBe('store-1');
    expect(line.before).toMatchObject({ totalRefunded: 0, environment: Environment.LIVE });
    expect(line.after).toMatchObject({
      totalRefunded: 2_500,
      environment: Environment.LIVE,
      amount: 2_500,
    });
  });

  it('recusa quando o ambiente declarado nao e o do pagamento', async () => {
    const fixture = makeFixture(Environment.LIVE);

    await expect(
      fixture.useCase.execute({
        operatorId: 'operator-1',
        storeId: 'store-1',
        paymentId: fixture.payment.id,
        amount: 2_500,
        environment: Environment.TEST,
        reason: 'chamado #414',
      }),
    ).rejects.toBeInstanceOf(LiveEnvironmentNotAllowedError);

    expect(fixture.repos.refundRepository.save).not.toHaveBeenCalled();
    expect(fixture.trail).toHaveLength(0);
  });

  it('exige motivo, e nao move nada sem ele', async () => {
    const fixture = makeFixture();

    await expect(
      fixture.useCase.execute({
        operatorId: 'operator-1',
        storeId: 'store-1',
        paymentId: fixture.payment.id,
        amount: 2_500,
        environment: Environment.LIVE,
        reason: '',
      }),
    ).rejects.toBeInstanceOf(OperatorDecisionReasonRequiredError);

    expect(fixture.repos.refundRepository.save).not.toHaveBeenCalled();
    expect(fixture.trail).toHaveLength(0);
  });
});
