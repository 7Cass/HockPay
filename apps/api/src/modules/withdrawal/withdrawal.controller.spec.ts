import {
  CreateWithdrawalUseCase,
  Environment,
  GetWithdrawalUseCase,
  ListWithdrawalsUseCase,
} from '@hockpay/core';
import { WithdrawalController } from './withdrawal.controller';

describe('WithdrawalController', () => {
  function makeController(
    overrides: {
      createWithdrawalUseCase?: Partial<CreateWithdrawalUseCase>;
      listWithdrawalsUseCase?: Partial<ListWithdrawalsUseCase>;
      getWithdrawalUseCase?: Partial<GetWithdrawalUseCase>;
      idempotencyService?: any;
    } = {},
  ) {
    const createWithdrawalUseCase = {
      executeInTransaction: jest.fn(),
      ...overrides.createWithdrawalUseCase,
    };
    const listWithdrawalsUseCase = {
      execute: jest.fn(),
      ...overrides.listWithdrawalsUseCase,
    };
    const getWithdrawalUseCase = {
      execute: jest.fn(),
      ...overrides.getWithdrawalUseCase,
    };
    const idempotencyService = {
      execute: jest.fn(),
      ...overrides.idempotencyService,
    };

    return {
      controller: new WithdrawalController(
        createWithdrawalUseCase as unknown as CreateWithdrawalUseCase,
        listWithdrawalsUseCase as unknown as ListWithdrawalsUseCase,
        getWithdrawalUseCase as unknown as GetWithdrawalUseCase,
        idempotencyService,
      ),
      createWithdrawalUseCase,
      listWithdrawalsUseCase,
      getWithdrawalUseCase,
      idempotencyService,
    };
  }

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
    const { controller, createWithdrawalUseCase, idempotencyService } =
      makeController({
        createWithdrawalUseCase: {
          executeInTransaction: jest.fn().mockResolvedValue({ withdrawal }),
        },
        idempotencyService: {
          execute: jest.fn(async (input) => {
            const body = await input.operation(repos);
            return {
              body,
              status: input.responseStatus,
              replayed: false,
            };
          }),
        },
      });
    const response = {
      status: jest.fn(),
      setHeader: jest.fn(),
    };

    const result = await controller.create(
      {
        bankAccountId: 'bank-account-1',
        amount: 1000,
      },
      'store-1',
      Environment.TEST,
      {
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
        environment: Environment.TEST,
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

  it('lists withdrawals using the current store decorator value', async () => {
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
    const { controller, listWithdrawalsUseCase } = makeController({
      listWithdrawalsUseCase: {
        execute: jest.fn().mockResolvedValue({
          withdrawals: [withdrawal],
          total: 1,
          page: 2,
          limit: 10,
          totalPages: 1,
          summary: { totalCount: 1 },
        }),
      },
    });

    const result = await controller.list(
      {
        page: 2,
        limit: 10,
        status: 'PENDING' as any,
        bankAccountId: 'bank-account-1',
        q: 'abc',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      },
      'store-1',
    );

    expect(listWithdrawalsUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      page: 2,
      limit: 10,
      status: 'PENDING',
      bankAccountId: 'bank-account-1',
      q: 'abc',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
    });
    expect(result.withdrawals).toHaveLength(1);
  });

  it('gets withdrawal details using the current store decorator value', async () => {
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
    const { controller, getWithdrawalUseCase } = makeController({
      getWithdrawalUseCase: {
        execute: jest.fn().mockResolvedValue({
          withdrawal,
          bankAccount: null,
          transactions: [],
          timeline: [],
        }),
      },
    });

    const result = await controller.get('withdrawal-1', 'store-1');

    expect(getWithdrawalUseCase.execute).toHaveBeenCalledWith({
      storeId: 'store-1',
      withdrawalId: 'withdrawal-1',
    });
    expect(result.withdrawal.id).toBe('withdrawal-1');
  });
});
