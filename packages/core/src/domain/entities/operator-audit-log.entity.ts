/**
 * Actions the operator surface can record.
 *
 * The list grows with each power added to the desk. It is a closed set on
 * purpose: an audit trail whose vocabulary is free text stops being queryable
 * the moment two people spell the same action differently.
 */
export const OPERATOR_AUDIT_ACTION = {
  LOGIN: 'operator.login',
  LOGOUT: 'operator.logout',
} as const;

export type OperatorAuditAction =
  (typeof OPERATOR_AUDIT_ACTION)[keyof typeof OPERATOR_AUDIT_ACTION];

/**
 * State snapshot recorded before/after an action.
 */
export type OperatorAuditState = Record<string, unknown>;

/**
 * Domain Entity: OperatorAuditLog
 *
 * One line of the operator audit trail. The entity has no mutating behaviour
 * because the trail is append-only: a recorded line is never corrected, only
 * followed by another line.
 */
export class OperatorAuditLog {
  private readonly _id: string;
  private readonly _operatorId: string;
  private readonly _action: OperatorAuditAction;
  private readonly _targetType: string;
  private readonly _targetId?: string;
  private readonly _before?: OperatorAuditState;
  private readonly _after?: OperatorAuditState;
  private readonly _reason?: string;
  private readonly _requestId?: string;
  private readonly _createdAt: Date;

  private constructor(props: OperatorAuditLogProps) {
    this._id = props.id;
    this._operatorId = props.operatorId;
    this._action = props.action;
    this._targetType = props.targetType;
    this._targetId = props.targetId;
    this._before = props.before;
    this._after = props.after;
    this._reason = props.reason;
    this._requestId = props.requestId;
    this._createdAt = props.createdAt;
  }

  /**
   * Record a new line of the trail.
   */
  static record(props: RecordOperatorAuditLogProps): OperatorAuditLog {
    return new OperatorAuditLog({
      id: crypto.randomUUID(),
      operatorId: props.operatorId,
      action: props.action,
      targetType: props.targetType,
      targetId: props.targetId,
      before: props.before,
      after: props.after,
      reason: props.reason,
      requestId: props.requestId,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: OperatorAuditLogProps): OperatorAuditLog {
    return new OperatorAuditLog(props);
  }

  // Getters

  get id(): string {
    return this._id;
  }

  get operatorId(): string {
    return this._operatorId;
  }

  get action(): OperatorAuditAction {
    return this._action;
  }

  get targetType(): string {
    return this._targetType;
  }

  get targetId(): string | undefined {
    return this._targetId;
  }

  get before(): OperatorAuditState | undefined {
    return this._before;
  }

  get after(): OperatorAuditState | undefined {
    return this._after;
  }

  get reason(): string | undefined {
    return this._reason;
  }

  get requestId(): string | undefined {
    return this._requestId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  toObject(): OperatorAuditLogObject {
    return {
      id: this._id,
      operatorId: this._operatorId,
      action: this._action,
      targetType: this._targetType,
      targetId: this._targetId ?? null,
      before: this._before ?? null,
      after: this._after ?? null,
      reason: this._reason ?? null,
      requestId: this._requestId ?? null,
      createdAt: this._createdAt,
    };
  }
}

/**
 * Properties needed to record a new line of the trail.
 */
export interface RecordOperatorAuditLogProps {
  operatorId: string;
  action: OperatorAuditAction;
  targetType: string;
  targetId?: string;
  before?: OperatorAuditState;
  after?: OperatorAuditState;
  reason?: string;
  requestId?: string;
}

/**
 * All properties of a line (for reconstitution from persistence).
 */
export interface OperatorAuditLogProps extends RecordOperatorAuditLogProps {
  id: string;
  createdAt: Date;
}

/**
 * Serialized line, as returned by the operator surface.
 */
export interface OperatorAuditLogObject {
  id: string;
  operatorId: string;
  action: OperatorAuditAction;
  targetType: string;
  targetId: string | null;
  before: OperatorAuditState | null;
  after: OperatorAuditState | null;
  reason: string | null;
  requestId: string | null;
  createdAt: Date;
}
