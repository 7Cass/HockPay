import { BadRequestException } from '@nestjs/common';
import {
  Environment,
  OperatorCreateRefundUseCase,
  OperatorCreateWithdrawalUseCase,
} from '@hockpay/core';
import { OperatorStoreMoneyController } from './operator-store-money.controller';

/**
 * The desk's money routes do their own idempotency, because the shared
 * interceptor takes the store from a merchant session these requests do not
 * have. That hand-written half is what this file covers: the header is
 * required, and the reservation is scoped to the store the desk acts *for*,
 * not to the operator.
 */
describe('OperatorStoreMoneyController', () => {
  function makeController(
    overrides: {
      withdrawal?: any;
      refund?: any;
      idempotencyService?: any;
    } = {},
  ) {
    const operatorCreateWithdrawalUseCase = {
      executeInTransaction: jest.fn().mockResolvedValue({}),
      ...overrides.withdrawal,
    };
    const operatorCreateRefundUseCase = {
      executeInTransaction: jest.fn().mockResolvedValue({}),
      ...overrides.refund,
    };
    const idempotencyService = {
      execute: jest.fn(async (input: any) => ({
        body: await input.operation({}),
        status: 201,
        replayed: false,
      })),
      ...overrides.idempotencyService,
    };

    return {
      controller: new OperatorStoreMoneyController(
        operatorCreateWithdrawalUseCase as unknown as OperatorCreateWithdrawalUseCase,
        operatorCreateRefundUseCase as unknown as OperatorCreateRefundUseCase,
        idempotencyService,
      ),
      operatorCreateWithdrawalUseCase,
      operatorCreateRefundUseCase,
      idempotencyService,
    };
  }

  const operator = { operatorId: 'operator-1' } as any;

  function makeRequest(headers: Record<string, string> = {}): any {
    return {
      method: 'POST',
      path: '/operator/stores/store-1/withdrawals',
      headers,
    };
  }

  function makeResponse(): any {
    return { status: jest.fn(), setHeader: jest.fn() };
  }

  const withdrawalDto = {
    bankAccountId: 'bank-1',
    amount: 10_000,
    environment: Environment.LIVE,
    reason: 'chamado #412',
  } as any;

  const refundDto = {
    paymentId: 'payment-1',
    amount: 2_500,
    environment: Environment.LIVE,
    reason: 'chamado #413',
  } as any;

  it('refuses a withdrawal with no Idempotency-Key', async () => {
    const { controller, idempotencyService } = makeController();

    await expect(
      controller.createWithdrawal(
        'store-1',
        withdrawalDto,
        operator,
        makeRequest(),
        makeResponse(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(idempotencyService.execute).not.toHaveBeenCalled();
  });

  it('refuses a refund with no Idempotency-Key', async () => {
    const { controller, idempotencyService } = makeController();

    await expect(
      controller.createRefund(
        'store-1',
        refundDto,
        operator,
        makeRequest(),
        makeResponse(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(idempotencyService.execute).not.toHaveBeenCalled();
  });

  it('scopes the reservation to the target store and the stated environment', async () => {
    const { controller, idempotencyService, operatorCreateWithdrawalUseCase } =
      makeController();

    await controller.createWithdrawal(
      'store-1',
      withdrawalDto,
      operator,
      makeRequest({ 'idempotency-key': 'key-1' }),
      makeResponse(),
    );

    expect(idempotencyService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'key-1',
        storeId: 'store-1',
        environment: Environment.LIVE,
      }),
    );
    expect(
      operatorCreateWithdrawalUseCase.executeInTransaction,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        operatorId: 'operator-1',
        storeId: 'store-1',
        bankAccountId: 'bank-1',
        amount: 10_000,
        environment: Environment.LIVE,
        reason: 'chamado #412',
      }),
      expect.anything(),
    );
  });

  it('carries the operator and the store into the refund', async () => {
    const { controller, operatorCreateRefundUseCase } = makeController();

    await controller.createRefund(
      'store-1',
      refundDto,
      operator,
      makeRequest({ 'idempotency-key': 'key-2' }),
      makeResponse(),
    );

    expect(
      operatorCreateRefundUseCase.executeInTransaction,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        operatorId: 'operator-1',
        storeId: 'store-1',
        paymentId: 'payment-1',
        amount: 2_500,
        environment: Environment.LIVE,
        reason: 'chamado #413',
      }),
      expect.anything(),
    );
  });

  it('reports the replay state back on the response headers', async () => {
    const { controller } = makeController({
      idempotencyService: {
        execute: jest
          .fn()
          .mockResolvedValue({ body: {}, status: 200, replayed: true }),
      },
    });
    const res = makeResponse();

    await controller.createWithdrawal(
      'store-1',
      withdrawalDto,
      operator,
      makeRequest({ 'idempotency-key': 'key-1' }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith(
      'x-idempotency-replayed',
      'true',
    );
    expect(res.setHeader).toHaveBeenCalledWith('x-idempotency-key', 'key-1');
  });
});
