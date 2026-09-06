import { OperatorAuditLog } from '../entities/operator-audit-log.entity';

/**
 * Repository contract for the operator audit trail.
 *
 * The trail is append-only, and that is enforced by absence: there is no
 * `update` and no `delete` to call. The contract is the guarantee -- not a
 * convention someone has to remember.
 */
export interface IOperatorAuditLogRepository {
  append(log: OperatorAuditLog): Promise<void>;

  /**
   * Read a page of the trail, newest first.
   */
  list(query: ListOperatorAuditLogsQuery): Promise<OperatorAuditLog[]>;
}

export interface ListOperatorAuditLogsQuery {
  limit: number;
  offset: number;
  operatorId?: string;
}
