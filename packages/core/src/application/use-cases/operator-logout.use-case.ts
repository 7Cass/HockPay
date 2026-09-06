import {
  OPERATOR_AUDIT_ACTION,
  OperatorAuditLog,
} from '../../domain/entities/operator-audit-log.entity';
import { IUnitOfWork } from '../../domain/repositories/unit-of-work.interface';

export interface IOperatorLogoutInput {
  refreshToken: string;
  requestId?: string;
}

/**
 * Use Case: Operator Logout
 *
 * Revokes the session and records it, in one transaction. Logout of a token
 * that no longer exists is a no-op: it leaves no line, because no session was
 * closed.
 */
export class OperatorLogoutUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(input: IOperatorLogoutInput): Promise<void> {
    await this.unitOfWork.execute(async (repos) => {
      const token = await repos.operatorRefreshTokenRepository.findByTokenForUpdate(
        input.refreshToken,
      );

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
