import { CustomerObject } from '../../domain/entities/customer.entity';
import { ICustomerRepository } from '../../domain/repositories/customer.repository.interface';
import { CustomerNotFoundError } from '../../domain/errors/customer-not-found.error';

/**
 * Input DTO for GetCustomerUseCase.
 */
export interface IGetCustomerInput {
  storeId: string;
  externalId: string;
}

/**
 * Output DTO for GetCustomerUseCase.
 */
export interface IGetCustomerOutput {
  customer: CustomerObject;
}

/**
 * Use Case: Get Customer
 *
 * This use case handles fetching a customer by externalId.
 */
export class GetCustomerUseCase {
  constructor(private readonly customerRepository: ICustomerRepository) {}

  async execute(input: IGetCustomerInput): Promise<IGetCustomerOutput> {
    const customer = await this.customerRepository.findByExternalId(
      input.storeId,
      input.externalId,
    );

    if (!customer) {
      throw new CustomerNotFoundError(input.externalId);
    }

    return {
      customer: customer.toObject(),
    };
  }
}
