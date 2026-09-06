import { OperatorInactiveError } from '../../domain/errors/operator-inactive.error';
import { OperatorNotFoundError } from '../../domain/errors/operator-not-found.error';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';

export interface IGetOperatorInput {
  operatorId: string;
}

export interface IGetOperatorOutput {
  id: string;
  name: string;
  email: string;
}

/**
 * Use Case: Get Operator
 *
 * Reads the operator behind the current session. It also rejects an operator
 * deactivated after the token was minted -- the token stays valid for its 15
 * minutes, the account does not.
 */
export class GetOperatorUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(input: IGetOperatorInput): Promise<IGetOperatorOutput> {
    const operator = await this.unitOfWork.execute((repos) =>
      repos.operatorRepository.findById(input.operatorId),
    );

    if (!operator) {
      throw new OperatorNotFoundError(input.operatorId);
    }

    if (!operator.canLogin()) {
      throw new OperatorInactiveError();
    }

    return {
      id: operator.id,
      name: operator.name,
      email: operator.email.toString(),
    };
  }
}
