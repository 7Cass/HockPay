import { Operator } from '../entities/operator.entity';

/**
 * Repository contract for the operator principal.
 *
 * There is no `findByStoreId` and no relation to merchant here: an operator is
 * not reachable through any merchant-scoped query.
 */
export interface IOperatorRepository {
  create(operator: Operator): Promise<void>;

  findById(id: string): Promise<Operator | null>;

  /**
   * Find an operator and lock the row for the current transaction.
   */
  findByIdForUpdate(id: string): Promise<Operator | null>;

  findByEmail(email: string): Promise<Operator | null>;
}
