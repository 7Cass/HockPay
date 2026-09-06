import { AccountObject } from '../../domain/entities/account.entity';
import { AccountNotFoundError } from '../../domain/errors/account-not-found.error';
import { IAccountRepository } from '../../domain/repositories/account.repository.interface';
import { Environment } from '../../domain/value-objects/environment.vo';

/**
 * Input DTO for GetAccountUseCase.
 */
export interface IGetAccountInput {
  storeId: string;
  environment: Environment;
}

/**
 * Output DTO for GetAccountUseCase.
 */
export interface IGetAccountOutput {
  account: AccountObject;
}

/**
 * Use Case: Get Account
 *
 * This use case handles retrieving a store's financial account.
 * It will return the balances (available, pending, blocked) in raw cents.
 */
export class GetAccountUseCase {
  constructor(private readonly accountRepository: IAccountRepository) {}

  async execute(input: IGetAccountInput): Promise<IGetAccountOutput> {
    const account = await this.accountRepository.findByStoreIdAndEnvironment(
      input.storeId,
      input.environment,
    );

    if (!account) {
      throw new AccountNotFoundError(input.storeId);
    }

    return {
      account: account.toObject(),
    };
  }
}
