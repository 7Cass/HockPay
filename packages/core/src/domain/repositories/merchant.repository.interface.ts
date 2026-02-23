import { Merchant } from '../entities/merchant.entity';

/**
 * Interface for Merchant Repository.
 *
 * This interface is defined in the domain layer and represents the contract
 * that any infrastructure implementation must follow.
 *
 * The application layer depends on this interface, not on the concrete implementation.
 * This follows the Dependency Inversion Principle from Clean Architecture.
 */
export interface IMerchantRepository {
  /**
   * Save a new merchant to the repository.
   */
  save(merchant: Merchant): Promise<void>;

  /**
   * Find a merchant by ID.
   * Returns null if not found.
   */
  findById(id: string): Promise<Merchant | null>;

  /**
   * Find a merchant by email.
   * Returns null if not found.
   */
  findByEmail(email: string): Promise<Merchant | null>;

  /**
   * Find a merchant by document (CPF/CNPJ).
   * Returns null if not found.
   */
  findByDocument(document: string): Promise<Merchant | null>;

  /**
   * Check if a merchant already exists with the given email or document.
   * Returns true if a merchant exists with either the email or document.
   */
  existsByEmailOrDocument(email: string, document: string): Promise<boolean>;

  /**
   * Delete a merchant by ID.
   */
  delete(id: string): Promise<void>;

  /**
   * Update a merchant.
   */
  update(merchant: Merchant): Promise<void>;
}
