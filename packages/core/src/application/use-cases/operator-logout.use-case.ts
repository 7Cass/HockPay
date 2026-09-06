import {
  OPERATOR_AUDIT_ACTION,
  OperatorAuditLog,
} from '../../domain/entities/operator-audit-log.entity';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';

export interface IOperatorLogoutInput {
  operatorId: string;
  requestId?: string;
}

/**
 * Use Case: Operator Logout
 *
 * Closes the session of the authenticated operator and records it, in one
 * transaction. It revokes by principal, not by the refresh cookie: that cookie
 * is scoped to the refresh path and is never sent to this route.
 *
 * Logging out with no open session is a no-op and leaves no line, because no
 * session was closed.
 */
export class OperatorLogoutUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(input: IOperatorLogoutInput): Promise<void> {
    await this.unitOfWork.execute(async (repos) => {
      const token = await repos.operatorRefreshTokenRepository.findByOperatorId(input.operatorId);

      if (!token || token.isRevoked()) {
        return;
      }

      token.revoke();
      await repos.operatorRefreshTokenRepository.update(token);

      await repos.operatorAuditLogRepository.append(
        OperatorAuditLog.record({
          operatorId: token.operatorId,
          action: OPERATOR_AUDIT_ACTION.LOGOUT,
          targetType: 'operator',
          targetId: token.operatorId,
          requestId: input.requestId,
        }),
      );
    });
  }
}
