import { Email } from '../value-objects/email.vo';

/**
 * Domain Entity: Operator
 *
 * Represents whoever operates the hockpay instance -- the internal desk that
 * approves stores, adjusts commercial terms and investigates a case.
 *
 * It is a principal of its own: there is no relation to Merchant, and no path
 * that turns a merchant into an operator.
 */
export class Operator {
  private readonly _id: string;
  private readonly _email: Email;
  private readonly _passwordHash: string;
  private readonly _name: string;
  private readonly _isActive: boolean;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;

  private constructor(props: OperatorProps) {
    this._id = props.id;
    this._email = props.email;
    this._passwordHash = props.passwordHash;
    this._name = props.name;
    this._isActive = props.isActive ?? true;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  /**
   * Factory method to create a brand new Operator.
   *
   * Operators are provisioned by CLI, never by public signup.
   */
  static create(props: CreateOperatorProps): Operator {
    const now = new Date();

    return new Operator({
      id: crypto.randomUUID(),
      email: props.email,
      passwordHash: props.passwordHash,
      name: props.name,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Factory method to reconstitute an Operator from persistence.
   */
  static reconstitute(props: OperatorProps): Operator {
    return new Operator(props);
  }

  // Getters

  get id(): string {
    return this._id;
  }

  get email(): Email {
    return this._email;
  }

  get passwordHash(): string {
    return this._passwordHash;
  }

  get name(): string {
    return this._name;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Whether this operator may open a session.
   */
  canLogin(): boolean {
    return this._isActive;
  }

  toObject(): OperatorObject {
    return {
      id: this._id,
      email: this._email.toString(),
      name: this._name,
      isActive: this._isActive,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}

/**
 * Properties needed to create a new Operator.
 */
export interface CreateOperatorProps {
  email: Email;
  passwordHash: string;
  name: string;
}

/**
 * All properties of an Operator (for reconstitution from persistence).
 */
export interface OperatorProps {
  id: string;
  email: Email;
  passwordHash: string;
  name: string;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Simplified object representation of an Operator (for serialization).
 *
 * The password hash is deliberately absent.
 */
export interface OperatorObject {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
