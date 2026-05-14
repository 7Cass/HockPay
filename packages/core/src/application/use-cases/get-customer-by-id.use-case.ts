import { CustomerObject } from '../../domain/entities/customer.entity';
import { CustomerNotFoundError } from '../../domain/errors/customer-not-found.error';
import { ICustomerRepository } from '../../domain/repositories/customer.repository.interface';

export interface IGetCustomerByIdInput {
  storeId: string;
  customerId: string;
}

export interface IGetCustomerByIdOutput {
  customer: CustomerObject;
}

export class GetCustomerByIdUseCase {
  constructor(private readonly customerRepository: ICustomerRepository) {}

  async execute(input: IGetCustomerByIdInput): Promise<IGetCustomerByIdOutput> {
    const customer = await this.customerRepository.findById(input.customerId);

    if (!customer || customer.storeId !== input.storeId) {
      throw new CustomerNotFoundError(input.customerId);
    }

    return {
      customer: customer.toObject(),
    };
  }
}
