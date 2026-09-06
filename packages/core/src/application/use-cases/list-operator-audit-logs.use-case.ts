import { OperatorAuditLogObject } from '../../domain/entities/operator-audit-log.entity';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export interface IListOperatorAuditLogsInput {
  limit?: number;
  offset?: number;
  operatorId?: string;
}

export interface IListOperatorAuditLogsOutput {
  data: OperatorAuditLogObject[];
  limit: number;
  offset: number;
}

/**
 * Use Case: List Operator Audit Logs
 *
 * Reads the trail newest first. A trail that only exists in the database is a
 * log, not a trail -- this is what makes it visible on the operator surface.
 */
export class ListOperatorAuditLogsUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(input: IListOperatorAuditLogsInput = {}): Promise<IListOperatorAuditLogsOutput> {
    const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Math.max(input.offset ?? 0, 0);

    const logs = await this.unitOfWork.execute((repos) =>
      repos.operatorAuditLogRepository.list({
        limit,
        offset,
        operatorId: input.operatorId,
      }),
    );

    return {
      data: logs.map((log) => log.toObject()),
      limit,
      offset,
    };
  }
}
