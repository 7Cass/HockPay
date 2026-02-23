import { Customer } from '../entities/customer.entity';

/**
 * Parameters for listing customers.
 */
export interface ListCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
}

/**
 * Result of listing customers.
 */
export interface ListCustomersResult {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Interface for Customer Repository.
 *
 * This interface is defined in the domain layer and represents the contract
 * that any infrastructure implementation must follow.
 */
export interface ICustomerRepository {
  /**
   * Save a new customer to the repository.
   */
  save(customer: Customer): Promise<void>;

  /**
   * Find a customer by ID.
   * Returns null if not found.
   */
  findById(id: string): Promise<Customer | null>;

  /**
   * Find a customer by externalId within a store.
   * Returns null if not found.
   */
  findByExternalId(storeId: string, externalId: string): Promise<Customer | null>;

  /**
   * Find a customer by document within a store.
   * Returns null if not found.
   */
  findByDocument(storeId: string, document: string): Promise<Customer | null>;

  /**
   * Update a customer.
   */
  update(customer: Customer): Promise<void>;

  /**
   * List customers for a store with pagination and optional search.
   */
  list(storeId: string, params: ListCustomersParams): Promise<ListCustomersResult>;

  /**
   * Delete a customer by ID.
   */
  delete(id: string): Promise<void>;
}
