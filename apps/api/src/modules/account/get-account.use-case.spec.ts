import { Test, TestingModule } from '@nestjs/testing';
import { GetAccountUseCase, AccountNotFoundError, AccountObject } from '@hockpay/core';
import { AccountRepository } from '@hockpay/infrastructure';
import { PrismaService } from '../../infra/database/prisma.service';

describe('GetAccountUseCase', () => {
    let useCase: GetAccountUseCase;
    let mockAccountRepository: Partial<AccountRepository>;

    beforeEach(async () => {
        // Create mock repository
        mockAccountRepository = {
            findByStoreId: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                {
                    provide: GetAccountUseCase,
                    useFactory: () => {
                        return new GetAccountUseCase(mockAccountRepository as AccountRepository);
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
        (mockAccountRepository.findByStoreId as jest.Mock).mockResolvedValue(null);

        await expect(useCase.execute({ storeId: 'invalid-id' })).rejects.toThrow(
            AccountNotFoundError,
        );
    });

    it('should return account balances when it exists', async () => {
        const fakeAccountData = {
            id: 'fake-account-id',
            storeId: 'valid-store-id',
            available: 1500,
            pending: 500,
            blocked: 0,
            currency: 'BRL',
            updatedAt: new Date(),
            toObject: function (): AccountObject {
                return {
                    id: this.id,
                    storeId: this.storeId,
                    available: this.available,
                    pending: this.pending,
                    blocked: this.blocked,
                    currency: this.currency,
                    updatedAt: this.updatedAt
                }
            }
        };

        (mockAccountRepository.findByStoreId as jest.Mock).mockResolvedValue(fakeAccountData);

        const result = await useCase.execute({ storeId: 'valid-store-id' });

        expect(result.account).toBeDefined();
        expect(result.account.storeId).toBe('valid-store-id');
        expect(result.account.available).toBe(1500);
        expect(result.account.pending).toBe(500);
        expect(result.account.blocked).toBe(0);
        expect(result.account.currency).toBe('BRL');
    });
});
