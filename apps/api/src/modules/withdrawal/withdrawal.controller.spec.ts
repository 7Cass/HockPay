import {
  CreateWithdrawalUseCase,
  GetWithdrawalUseCase,
  ListWithdrawalsUseCase,
} from '@hockpay/core';
import { WithdrawalController } from './withdrawal.controller';

describe('WithdrawalController', () => {
  it('creates withdrawals through the transactional idempotency service', async () => {
    const repos = { withdrawalRepository: {} };
    const withdrawal = {
      id: 'withdrawal-1',
      accountId: 'account-1',
      bankAccountId: 'bank-account-1',
      amount: 1000,
      fee: 100,
      netAmount: 900,
      status: 'PENDING',
      processingAttempts: 0,
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    };
    const createWithdrawalUseCase = {
      executeInTransaction: jest.fn().mockResolvedValue({ withdrawal }),
    };
    const idempotencyService = {
      execute: jest.fn(async (input) => {
        const body = await input.operation(repos);
        return {
          body,
          status: input.responseStatus,
          replayed: false,
        };
      }),
    };
    const response = {
      status: jest.fn(),
      setHeader: jest.fn(),
    };
    const controller = new WithdrawalController(
      createWithdrawalUseCase as unknown as CreateWithdrawalUseCase,
      { execute: jest.fn() } as unknown as ListWithdrawalsUseCase,
      { execute: jest.fn() } as unknown as GetWithdrawalUseCase,
      idempotencyService as any,
    );

    const result = await controller.create(
      {
        bankAccountId: 'bank-account-1',
        amount: 1000,
      },
      {
        store: { id: 'store-1' },
        id: 'req-1',
        method: 'POST',
        path: '/withdrawals',
        headers: { 'idempotency-key': 'idem-1' },
      } as any,
      response as any,
    );

    expect(idempotencyService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'idem-1',
        storeId: 'store-1',
        method: 'POST',
        path: '/withdrawals',
        responseStatus: 201,
      }),
    );
    expect(createWithdrawalUseCase.executeInTransaction).toHaveBeenCalledWith(
      {
        storeId: 'store-1',
        bankAccountId: 'bank-account-1',
        amount: 1000,
        requestId: 'req-1',
      },
      repos,
    );
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-idempotency-key',
      'idem-1',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-idempotency-replayed',
      'false',
    );
    expect(result).toEqual({ withdrawal });
  });
});
