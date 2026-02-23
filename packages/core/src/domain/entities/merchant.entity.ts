import { Email } from '../value-objects/email.vo';
import { Document } from '../value-objects/document.vo';

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
  createdAt: Date;
  updatedAt: Date;
}
