import { Email } from '../value-objects/email.vo';
import { Document } from '../value-objects/document.vo';
import { Environment } from '../value-objects/environment.vo';

/**
 * Domain Entity: Merchant
 *
 * Represents a merchant account in the system.
 * This is a pure domain entity with no dependencies on external frameworks.
 */
export class Merchant {
  private readonly _id: string;
  private readonly _email: Email;
  private readonly _passwordHash: string;
  private readonly _name: string;
  private readonly _document: Document;
  private readonly _isActive: boolean;
  private _currentStoreId?: string;
  private _currentEnvironment: Environment;
  private readonly _createdAt: Date;
  private readonly _updatedAt: Date;

  private constructor(props: MerchantProps) {
    this._id = props.id;
    this._email = props.email;
    this._passwordHash = props.passwordHash;
    this._name = props.name;
    this._document = props.document;
    this._isActive = props.isActive ?? true;
    this._currentStoreId = props.currentStoreId;
    this._currentEnvironment = props.currentEnvironment ?? Environment.TEST;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  /**
   * Factory method to create a new Merchant.
   * Use this when creating a brand new merchant (not from persistence).
   */
  static create(props: CreateMerchantProps): Merchant {
    return new Merchant({
      id: crypto.randomUUID(),
      email: props.email,
      document: props.document,
      passwordHash: props.passwordHash,
      name: props.name,
      isActive: true,
      currentEnvironment: Environment.TEST,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Factory method to reconstitute a Merchant from persistence.
   * Use this when loading a merchant from the database.
   */
  static reconstitute(props: MerchantProps): Merchant {
    return new Merchant(props);
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

  get document(): Document {
    return this._document;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get currentStoreId(): string | undefined {
    return this._currentStoreId;
  }

  /**
   * The environment this merchant's dashboard session reads and writes.
   *
   * It lives here, and not in the token, because the token is reissued every
   * 15 minutes and would have nowhere to read the environment back from: the
   * merchant would fall to TEST mid-session without having asked. The token
   * carries a copy; this is the source.
   */
  get currentEnvironment(): Environment {
    return this._currentEnvironment;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Check if the merchant is active.
   */
  canLogin(): boolean {
    return this._isActive;
  }

  /**
   * Verify if the provided password hash matches the stored hash.
   */
  verifyPassword(passwordHash: string): boolean {
    return this._passwordHash === passwordHash;
  }

  /**
   * Convert to plain object (useful for serialization).
   * Note: This returns a simplified representation, password hash is excluded.
   */
  toObject(): MerchantObject {
    return {
      id: this._id,
      email: this._email.toString(),
      name: this._name,
      document: this._document.value,
      formattedDocument: this._document.formatted,
      documentType: this._document.type,
      isActive: this._isActive,
      currentStoreId: this._currentStoreId,
      currentEnvironment: this._currentEnvironment,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  /**
   * Set the current store ID.
   */
  setCurrentStoreId(storeId: string | undefined): void {
    this._currentStoreId = storeId;
  }

  /**
   * Set the environment of the current session.
   *
   * Whether LIVE is allowed at all is a fact of the *store*, not of the
   * merchant, so the enablement gate lives in the use case that reads the
   * store -- not here.
   */
  setCurrentEnvironment(environment: Environment): void {
    this._currentEnvironment = environment;
  }
}

/**
 * Properties needed to create a new Merchant.
 */
export interface CreateMerchantProps {
  email: Email;
  document: Document;
  passwordHash: string;
  name: string;
  currentStoreId?: string;
}

/**
 * All properties of a Merchant (for reconstitution from persistence).
 */
export interface MerchantProps {
  id: string;
  email: Email;
  document: Document;
  passwordHash: string;
  name: string;
  isActive: boolean;
  currentStoreId?: string;
  currentEnvironment?: Environment;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Simplified object representation of a Merchant (for serialization).
 */
export interface MerchantObject {
  id: string;
  email: string;
  name: string;
  document: string;
  formattedDocument: string;
  documentType: 'CPF' | 'CNPJ';
  isActive: boolean;
  currentStoreId?: string;
  currentEnvironment: Environment;
  createdAt: Date;
  updatedAt: Date;
}
