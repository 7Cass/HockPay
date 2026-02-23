import { CustomerObject } from '../../domain/entities/customer.entity';
import { ICustomerRepository } from '../../domain/repositories/customer.repository.interface';
import { CustomerNotFoundError } from '../../domain/errors/customer-not-found.error';

/**
 * Input DTO for UpdateCustomerUseCase.
 */
export interface IUpdateCustomerInput {
  storeId: string;
  externalId: string;
  name?: string;
  email?: string;
  phone?: string;
  street?: string;
  number?: string;
  complement?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

/**
 * Output DTO for UpdateCustomerUseCase.
 */
export interface IUpdateCustomerOutput {
  customer: CustomerObject;
}

/**
 * Use Case: Update Customer
 *
 * This use case handles updating a customer by externalId.
 *
 * Business rules:
 * - Customer must exist
 * - Document cannot be changed
 */
export class UpdateCustomerUseCase {
  constructor(private readonly customerRepository: ICustomerRepository) {}

  async execute(input: IUpdateCustomerInput): Promise<IUpdateCustomerOutput> {
    // 1. Find customer by externalId
    const customer = await this.customerRepository.findByExternalId(
      input.storeId,
      input.externalId,
    );

    if (!customer) {
      throw new CustomerNotFoundError(input.externalId);
    }

    // 2. Update customer fields
    customer.update({
      name: input.name,
      email: input.email,
      phone: input.phone,
      street: input.street,
      number: input.number,
      complement: input.complement,
      city: input.city,
      state: input.state,
      zipCode: input.zipCode,
      country: input.country,
    });

    // 3. Persist changes
    await this.customerRepository.update(customer);

    // 4. Return output
    return {
      customer: customer.toObject(),
    };
  }
}
