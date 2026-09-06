import { WithdrawalObject } from '../../domain/entities/withdrawal.entity';
import { BankAccount } from '../../domain/entities/bank-account.entity';
import { TransactionObject, TransactionType } from '../../domain/entities/transaction.entity';
import { AccountNotFoundError } from '../../domain/errors/account-not-found.error';
import { WithdrawalNotFoundError } from '../../domain/errors/withdrawal-not-found.error';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';
import { Environment } from '../../domain/value-objects/environment.vo';

export interface IGetWithdrawalInput {
  storeId: string;
  withdrawalId: string;
  environment: Environment;
}

export interface IGetWithdrawalOutput {
  withdrawal: WithdrawalObject;
  bankAccount: ReturnType<BankAccount['toObject']> | null;
  transactions: TransactionObject[];
  timeline: WithdrawalTimelineEvent[];
}

export interface WithdrawalTimelineEvent {
  type: 'CREATED' | 'RESERVED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'REVERSED' | 'RETRY_SCHEDULED';
  label: string;
  occurredAt: Date;
  amount?: number;
  transactionId?: string;
  description?: string;
}

export class GetWithdrawalUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(input: IGetWithdrawalInput): Promise<IGetWithdrawalOutput> {
    return this.unitOfWork.execute(async (repos) => {
      const account = await repos.accountRepository.findByStoreIdAndEnvironment(
        input.storeId,
        input.environment,
      );
      if (!account) throw new AccountNotFoundError(input.storeId);

      const withdrawal = await repos.withdrawalRepository.findByIdAndAccountId(
        input.withdrawalId,
        account.id,
      );
      if (!withdrawal) throw new WithdrawalNotFoundError(input.withdrawalId);

      const [bankAccount, transactions] = await Promise.all([
        repos.bankAccountRepository.findById(withdrawal.bankAccountId),
        repos.transactionRepository.findByReference('WITHDRAWAL', withdrawal.id),
      ]);

      return {
        withdrawal: withdrawal.toObject(),
        bankAccount: bankAccount ? bankAccount.toObject() : null,
        transactions: transactions.map((transaction) => transaction.toObject()),
        timeline: this.buildTimeline(withdrawal.toObject(), transactions),
      };
    });
  }

  private buildTimeline(
    withdrawal: WithdrawalObject,
    transactions: Array<{
      id: string;
      type: TransactionType;
      amount: number;
      netAmount: number;
      createdAt: Date;
      description?: string;
    }>,
  ): WithdrawalTimelineEvent[] {
    const events: WithdrawalTimelineEvent[] = [
      {
        type: 'CREATED',
        label: 'Saque solicitado',
        occurredAt: withdrawal.createdAt,
        amount: withdrawal.amount,
        description: 'Solicitacao registrada para saque simulado.',
      },
    ];

    for (const transaction of transactions) {
      if (transaction.type === TransactionType.WITHDRAWAL_RESERVED) {
        events.push({
          type: 'RESERVED',
          label: 'Saldo reservado',
          occurredAt: transaction.createdAt,
          amount: transaction.amount,
          transactionId: transaction.id,
          description: transaction.description,
        });
      }
      if (transaction.type === TransactionType.WITHDRAWAL_SENT) {
        events.push({
          type: 'SENT',
          label: 'Saque simulado concluido',
          occurredAt: transaction.createdAt,
          amount: transaction.netAmount,
          transactionId: transaction.id,
          description: transaction.description,
        });
      }
      if (transaction.type === TransactionType.WITHDRAWAL_REVERSED) {
        events.push({
          type: 'REVERSED',
          label: 'Saldo devolvido',
          occurredAt: transaction.createdAt,
          amount: transaction.amount,
          transactionId: transaction.id,
          description: transaction.description,
        });
      }
    }

    if (withdrawal.processingAttempts > 0) {
      events.push({
        type: 'PROCESSING',
        label: `${withdrawal.processingAttempts} tentativa${withdrawal.processingAttempts === 1 ? '' : 's'} de processamento`,
        occurredAt: withdrawal.updatedAt,
        description: withdrawal.lastProcessingError,
      });
    }

    if (withdrawal.nextProcessAt) {
      events.push({
        type: 'RETRY_SCHEDULED',
        label: 'Nova tentativa agendada',
        occurredAt: withdrawal.nextProcessAt,
        description: withdrawal.lastProcessingError,
      });
    }

    if (withdrawal.status === 'FAILED') {
      events.push({
        type: 'FAILED',
        label: 'Saque falhou',
        occurredAt: withdrawal.updatedAt,
        description: withdrawal.failedReason,
      });
    }

    return events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  }
}
