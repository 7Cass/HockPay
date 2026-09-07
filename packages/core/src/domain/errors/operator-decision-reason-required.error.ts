import { DomainError } from './domain-error';

/**
 * Error thrown when an operator decision arrives without a reason.
 *
 * The rule lives in the use case and not in a DTO on purpose: a direct HTTP
 * client does not go through the screen, and an audit trail whose reason is
 * optional stops explaining anything the moment it matters.
 */
export class OperatorDecisionReasonRequiredError extends DomainError {
  constructor(action: string) {
    super(
      `A reason is required to ${action} a store for LIVE`,
      'OPERATOR_DECISION_REASON_REQUIRED',
    );
  }
}
