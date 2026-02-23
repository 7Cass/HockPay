import { CustomerObject } from '../../domain/entities/customer.entity';
import {
  ICustomerRepository,
  ListCustomersParams,
} from '../../domain/repositories/customer.repository.interface';

/**
 * Input DTO for ListCustomersUseCase.
 */
export interface IListCustomersInput {
  storeId: string;
  page?: number;
  limit?: number;
  search?: string;
}

/**
 * Output DTO for ListCustomersUseCase.
 */
export interface IListCustomersOutput {
  customers: CustomerObject[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Use Case: List Customers
 *
 * This use case handles listing customers for a store with pagination.
 */
export class ListCustomersUseCase {
  constructor(private readonly customerRepository: ICustomerRepository) {}

  async execute(input: IListCustomersInput): Promise<IListCustomersOutput> {
    const params: ListCustomersParams = {
      page: input.page ?? 1,
      limit: input.limit ?? 10,
      search: input.search,
    };

    const result = await this.customerRepository.list(input.storeId, params);

    return {
      customers: result.customers.map((c) => c.toObject()),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }
}
