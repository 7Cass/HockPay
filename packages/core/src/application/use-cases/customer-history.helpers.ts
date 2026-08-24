import { Customer } from '../../domain/entities/customer.entity';
import { CustomerNotFoundError } from '../../domain/errors/customer-not-found.error';
import { ICustomerRepository } from '../../domain/repositories/customer.repository.interface';

export async function resolveCustomerByExternalId(
  customerRepository: ICustomerRepository,
  storeId: string,
  customerExternalId: string,
): Promise<Customer> {
  const customer = await customerRepository.findByExternalId(storeId, customerExternalId);

  if (!customer) {
    throw new CustomerNotFoundError(customerExternalId);
  }

  return customer;
}
