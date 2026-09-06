import { Test, TestingModule } from '@nestjs/testing';
import {
  GetAccountUseCase,
  AccountNotFoundError,
  AccountObject,
  Environment,
} from '@hockpay/core';
import { AccountRepository } from '@hockpay/infrastructure';

describe('GetAccountUseCase', () => {
  let useCase: GetAccountUseCase;
  let mockAccountRepository: Partial<AccountRepository>;

  beforeEach(async () => {
    // Create mock repository
    mockAccountRepository = {
      findByStoreIdAndEnvironment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: GetAccountUseCase,
          useFactory: () => {
            return new GetAccountUseCase(
              mockAccountRepository as AccountRepository,
            );
          },
        },
      ],
    }).compile();

    useCase = module.get<GetAccountUseCase>(GetAccountUseCase);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should throw AccountNotFoundError if account does not exist', async () => {
    (
      mockAccountRepository.findByStoreIdAndEnvironment as jest.Mock
    ).mockResolvedValue(null);

    await expect(
      useCase.execute({ storeId: 'invalid-id', environment: Environment.TEST }),
    ).rejects.toThrow(AccountNotFoundError);
  });

  it('should return account balances when it exists', async () => {
    const fakeAccountData = {
      id: 'fake-account-id',
      storeId: 'valid-store-id',
      environment: Environment.TEST,
      available: 1500,
      pending: 500,
      blocked: 0,
      currency: 'BRL',
      updatedAt: new Date(),
      toObject: function (): AccountObject {
        return {
          id: this.id,
          storeId: this.storeId,
          environment: this.environment,
          available: this.available,
          pending: this.pending,
          blocked: this.blocked,
          currency: this.currency,
          updatedAt: this.updatedAt,
        };
      },
    };

    (
      mockAccountRepository.findByStoreIdAndEnvironment as jest.Mock
    ).mockResolvedValue(fakeAccountData);

    const result = await useCase.execute({
      storeId: 'valid-store-id',
      environment: Environment.TEST,
    });

    expect(
      mockAccountRepository.findByStoreIdAndEnvironment,
    ).toHaveBeenCalledWith('valid-store-id', Environment.TEST);
    expect(result.account).toBeDefined();
    expect(result.account.storeId).toBe('valid-store-id');
    expect(result.account.environment).toBe(Environment.TEST);
    expect(result.account.available).toBe(1500);
    expect(result.account.pending).toBe(500);
    expect(result.account.blocked).toBe(0);
    expect(result.account.currency).toBe('BRL');
  });
});
