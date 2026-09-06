import { Email } from '../../domain/value-objects/email.vo';
import { Operator } from '../../domain/entities/operator.entity';
import { OperatorAlreadyExistsError } from '../../domain/errors/operator-already-exists.error';
import { IPasswordHasherPort } from '../ports/password-hasher.port';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';

export interface ICreateOperatorInput {
  email: string;
  name: string;
  password: string;
}

export interface ICreateOperatorOutput {
  id: string;
  email: string;
  name: string;
}

/**
 * Use Case: Create Operator
 *
 * Provisioning path for the desk. It is reachable from the CLI only: there is
 * no public signup and no default operator created at boot, because an
 * automatically provisioned operator is a known credential.
 */
export class CreateOperatorUseCase {
  constructor(
    private readonly unitOfWork: IUnitOfWork,
    private readonly passwordHasher: IPasswordHasherPort,
  ) {}

  async execute(input: ICreateOperatorInput): Promise<ICreateOperatorOutput> {
    const email = new Email(input.email);
    const passwordHash = await this.passwordHasher.hash(input.password);

    return this.unitOfWork.execute(async (repos) => {
      const existing = await repos.operatorRepository.findByEmail(email.toString());

      if (existing) {
        throw new OperatorAlreadyExistsError(email.toString());
      }

      const operator = Operator.create({
        email,
        name: input.name,
        passwordHash,
      });

      await repos.operatorRepository.create(operator);

      return {
        id: operator.id,
        email: operator.email.toString(),
        name: operator.name,
      };
    });
  }
}
