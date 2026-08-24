import { OutboxEvent } from '../../domain/entities/outbox-event.entity';
import { WithdrawalObject } from '../../domain/entities/withdrawal.entity';
import { AccountNotFoundError } from '../../domain/errors/account-not-found.error';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';
import { sanitizeWithdrawal } from './create-withdrawal.use-case';

export interface IClaimProcessableWithdrawalsInput {
  limit: number;
  now?: Date;
  staleProcessingBefore?: Date;
  requestId?: string;
}

export interface IClaimProcessableWithdrawalsOutput {
  withdrawals: WithdrawalObject[];
}

export class ClaimProcessableWithdrawalsUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(
    input: IClaimProcessableWithdrawalsInput,
  ): Promise<IClaimProcessableWithdrawalsOutput> {
    return this.unitOfWork.execute(async (repos) => {
      const withdrawals = await repos.withdrawalRepository.claimProcessableWithdrawals({
        limit: input.limit,
        now: input.now,
        staleProcessingBefore: input.staleProcessingBefore,
      });

      const claimed: WithdrawalObject[] = [];

      for (const withdrawal of withdrawals) {
        const account = await repos.accountRepository.findById(withdrawal.accountId);
        if (!account) {
          throw new AccountNotFoundError(withdrawal.accountId);
        }

        const withdrawalObject = withdrawal.toObject();
        await repos.outboxWriter.save(
          OutboxEvent.create({
            aggregateType: 'Withdrawal',
            aggregateId: withdrawal.id,
            eventType: 'withdrawal.processing',
            requestId: input.requestId,
            storeId: account.storeId,
            payload: sanitizeWithdrawal(account.storeId, withdrawalObject),
          }),
        );
        claimed.push(withdrawalObject);
      }

      return { withdrawals: claimed };
    });
  }
}
