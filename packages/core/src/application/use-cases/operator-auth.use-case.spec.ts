import { describe, expect, it, vi } from 'vitest';
import { Operator } from '../../domain/entities/operator.entity';
import { OperatorRefreshToken } from '../../domain/entities/operator-refresh-token.entity';
import {
  OPERATOR_AUDIT_ACTION,
  OperatorAuditLog,
} from '../../domain/entities/operator-audit-log.entity';
import { InvalidCredentialsError } from '../../domain/errors/invalid-credentials.error';
import { InvalidRefreshTokenError } from '../../domain/errors/invalid-refresh-token.error';
import { OperatorInactiveError } from '../../domain/errors/operator-inactive.error';
import { Email } from '../../domain/value-objects/email.vo';
import { ITransactedRepositories } from '../../domain/repositories/unit-of-work.interface';
import { OperatorLoginUseCase } from './operator-login.use-case';
import { OperatorLogoutUseCase } from './operator-logout.use-case';
import { OperatorRefreshTokenUseCase } from './operator-refresh-token.use-case';

/**
 * In-memory stand-in for the transactional repositories.
 *
 * Writes are only committed when the whole callback resolves, which is what
 * lets these tests state the rule that matters: an audit line and the change
 * it describes live or die together.
 */
class FakeUnitOfWork {
  operators = new Map<string, Operator>();
  tokens = new Map<string, OperatorRefreshToken>();
  trail: OperatorAuditLog[] = [];
  failTokenCreate = false;

  async execute<T>(work: (repos: ITransactedRepositories) => Promise<T>): Promise<T> {
    const operators = new Map(this.operators);
    const tokens = new Map(this.tokens);
    const trail = [...this.trail];

    const repos = {
      operatorRepository: {
        create: async (operator: Operator) => {
          operators.set(operator.id, operator);
        },
        findById: async (id: string) => operators.get(id) ?? null,
        findByIdForUpdate: async (id: string) => operators.get(id) ?? null,
        findByEmail: async (email: string) =>
          [...operators.values()].find((o) => o.email.toString() === email) ?? null,
      },
      operatorRefreshTokenRepository: {
        create: async (token: OperatorRefreshToken) => {
          if (this.failTokenCreate) {
            throw new Error('refresh create failed');
          }
          tokens.set(token.token, token);
        },
        findByToken: async (token: string) => tokens.get(token) ?? null,
        findByOperatorId: async (operatorId: string) =>
          [...tokens.values()].find((t) => t.operatorId === operatorId) ?? null,
        findByTokenForUpdate: async (token: string) => tokens.get(token) ?? null,
        update: async (token: OperatorRefreshToken) => {
          tokens.set(token.token, token);
        },
        revokeAllForOperator: async (operatorId: string) => {
          for (const [key, token] of tokens) {
            if (token.operatorId === operatorId) {
              tokens.delete(key);
            }
          }
        },
      },
      operatorAuditLogRepository: {
        append: async (log: OperatorAuditLog) => {
          trail.push(log);
        },
        list: async () => [...trail].reverse(),
      },
    } as unknown as ITransactedRepositories;

    const result = await work(repos);

    this.operators = operators;
    this.tokens = tokens;
    this.trail = trail;

    return result;
  }
}

function makeOperator(overrides: { isActive?: boolean } = {}): Operator {
  return Operator.reconstitute({
    id: 'operator-1',
    email: new Email('desk@hockpay.local'),
    passwordHash: 'hash',
    name: 'Desk',
    isActive: overrides.isActive ?? true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

function makeLoginUseCase(unitOfWork: FakeUnitOfWork, passwordMatches = true) {
  return new OperatorLoginUseCase(
    unitOfWork as never,
    { hash: vi.fn(), verify: vi.fn().mockResolvedValue(passwordMatches) } as never,
    { generateAccessToken: vi.fn().mockResolvedValue('operator-access') } as never,
    { generateBase64: vi.fn().mockReturnValue('operator-refresh') } as never,
  );
}

describe('operator authentication', () => {
  it('records the session on the trail, with the request id', async () => {
    const unitOfWork = new FakeUnitOfWork();
    unitOfWork.operators.set('operator-1', makeOperator());

    await makeLoginUseCase(unitOfWork).execute({
      email: 'desk@hockpay.local',
      password: 'secret',
      requestId: 'req-1',
    });

    expect(unitOfWork.trail).toHaveLength(1);
    expect(unitOfWork.trail[0].action).toBe(OPERATOR_AUDIT_ACTION.LOGIN);
    expect(unitOfWork.trail[0].operatorId).toBe('operator-1');
    expect(unitOfWork.trail[0].requestId).toBe('req-1');
    expect(unitOfWork.tokens.get('operator-refresh')).toBeDefined();
  });

  it('leaves no line when the session it describes fails', async () => {
    const unitOfWork = new FakeUnitOfWork();
    unitOfWork.operators.set('operator-1', makeOperator());
    unitOfWork.failTokenCreate = true;

    await expect(
      makeLoginUseCase(unitOfWork).execute({
        email: 'desk@hockpay.local',
        password: 'secret',
      }),
    ).rejects.toThrow('refresh create failed');

    expect(unitOfWork.trail).toHaveLength(0);
  });

  it('rejects a wrong password without touching the trail', async () => {
    const unitOfWork = new FakeUnitOfWork();
    unitOfWork.operators.set('operator-1', makeOperator());

    await expect(
      makeLoginUseCase(unitOfWork, false).execute({
        email: 'desk@hockpay.local',
        password: 'wrong',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(unitOfWork.trail).toHaveLength(0);
  });

  it('refuses a deactivated operator', async () => {
    const unitOfWork = new FakeUnitOfWork();
    unitOfWork.operators.set('operator-1', makeOperator({ isActive: false }));

    await expect(
      makeLoginUseCase(unitOfWork).execute({
        email: 'desk@hockpay.local',
        password: 'secret',
      }),
    ).rejects.toBeInstanceOf(OperatorInactiveError);
  });

  it('records the logout and revokes the session', async () => {
    const unitOfWork = new FakeUnitOfWork();
    unitOfWork.operators.set('operator-1', makeOperator());
    unitOfWork.tokens.set(
      'operator-refresh',
      OperatorRefreshToken.create({ operatorId: 'operator-1', token: 'operator-refresh' }),
    );

    await new OperatorLogoutUseCase(unitOfWork as never).execute({
      operatorId: 'operator-1',
      requestId: 'req-2',
    });

    expect(unitOfWork.trail).toHaveLength(1);
    expect(unitOfWork.trail[0].action).toBe(OPERATOR_AUDIT_ACTION.LOGOUT);
    expect(unitOfWork.tokens.get('operator-refresh')?.isRevoked()).toBe(true);
  });

  it('leaves no line when logging out with no open session', async () => {
    const unitOfWork = new FakeUnitOfWork();

    await new OperatorLogoutUseCase(unitOfWork as never).execute({
      operatorId: 'operator-1',
    });

    expect(unitOfWork.trail).toHaveLength(0);
  });

  it('kills the session of an operator deactivated after login', async () => {
    const unitOfWork = new FakeUnitOfWork();
    unitOfWork.operators.set('operator-1', makeOperator({ isActive: false }));
    unitOfWork.tokens.set(
      'operator-refresh',
      OperatorRefreshToken.create({ operatorId: 'operator-1', token: 'operator-refresh' }),
    );

    const useCase = new OperatorRefreshTokenUseCase(
      unitOfWork as never,
      { generateAccessToken: vi.fn() } as never,
      { generateBase64: vi.fn().mockReturnValue('new-refresh') } as never,
    );

    await expect(useCase.execute({ refreshToken: 'operator-refresh' })).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );

    expect(unitOfWork.tokens.get('operator-refresh')?.isRevoked()).toBe(true);
  });
});
