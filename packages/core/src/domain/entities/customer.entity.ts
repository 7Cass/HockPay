import { Document } from '../value-objects/document.vo';

/**
 * Domain Entity: Customer
 *
 * Represents a customer in the system.
 * Customers are scoped to a store and identified by their document.
 */
export class Customer {
  private readonly _id: string;
  private readonly _storeId: string;
  private _externalId?: string;
  private _name?: string;
  private _email?: string;
  private readonly _document: Document;
  private _phone?: string;
  private _street?: string;
  private _number?: string;
  private _complement?: string;
  private _city?: string;
  private _state?: string;
  private _zipCode?: string;
  private _country?: string;
  private readonly _metadata?: Record<string, unknown>;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: CustomerProps) {
    this._id = props.id;
    this._storeId = props.storeId;
    this._externalId = props.externalId;
    this._name = props.name;
    this._email = props.email;
    this._document = props.document;
    this._phone = props.phone;
    this._street = props.street;
    this._number = props.number;
    this._complement = props.complement;
    this._city = props.city;
    this._state = props.state;
    this._zipCode = props.zipCode;
    this._country = props.country ?? 'BR';
    this._metadata = props.metadata;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  /**
   * Factory method to create a new Customer.
   * Use this when creating a brand new customer (not from persistence).
   */
  static create(props: CreateCustomerProps): Customer {
    return new Customer({
      id: crypto.randomUUID(),
      storeId: props.storeId,
      externalId: props.externalId,
      name: props.name,
      email: props.email,
      document: props.document,
      phone: props.phone,
      street: props.street,
      number: props.number,
      complement: props.complement,
      city: props.city,
      state: props.state,
      zipCode: props.zipCode,
      country: props.country ?? 'BR',
      metadata: props.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Factory method to reconstitute a Customer from persistence.
   * Use this when loading a customer from the database.
   */
  static reconstitute(props: CustomerProps): Customer {
    return new Customer(props);
  }

  // Getters

  get id(): string {
    return this._id;
  }

  get storeId(): string {
    return this._storeId;
  }

  get externalId(): string | undefined {
    return this._externalId;
  }

  get name(): string | undefined {
    return this._name;
  }

  get email(): string | undefined {
    return this._email;
  }

  get document(): Document {
    return this._document;
  }

  get phone(): string | undefined {
    return this._phone;
  }

  get street(): string | undefined {
    return this._street;
  }

  get number(): string | undefined {
    return this._number;
  }

  get complement(): string | undefined {
    return this._complement;
  }

  get city(): string | undefined {
    return this._city;
  }

  get state(): string | undefined {
    return this._state;
  }

  get zipCode(): string | undefined {
    return this._zipCode;
  }

  get country(): string | undefined {
    return this._country;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this._metadata;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Update customer fields.
   * Only updates fields that are provided.
   */
  update(props: UpdateCustomerProps): void {
    if (props.externalId !== undefined) this._externalId = props.externalId;
    if (props.name !== undefined) this._name = props.name;
    if (props.email !== undefined) this._email = props.email;
    if (props.phone !== undefined) this._phone = props.phone;
    if (props.street !== undefined) this._street = props.street;
    if (props.number !== undefined) this._number = props.number;
    if (props.complement !== undefined) this._complement = props.complement;
    if (props.city !== undefined) this._city = props.city;
    if (props.state !== undefined) this._state = props.state;
    if (props.zipCode !== undefined) this._zipCode = props.zipCode;
    if (props.country !== undefined) this._country = props.country;
    this._updatedAt = new Date();
  }

  /**
   * Convert to plain object (useful for serialization).
   */
  toObject(): CustomerObject {
    return {
      id: this._id,
      storeId: this._storeId,
      externalId: this._externalId,
      name: this._name,
      email: this._email,
      document: this._document.value,
      formattedDocument: this._document.formatted,
      documentType: this._document.type,
      phone: this._phone,
      street: this._street,
      number: this._number,
      complement: this._complement,
      city: this._city,
      state: this._state,
      zipCode: this._zipCode,
      country: this._country,
      metadata: this._metadata,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}

/**
 * Properties needed to create a new Customer.
 */
export interface CreateCustomerProps {
  storeId: string;
  externalId?: string;
  name?: string;
  email?: string;
  document: Document;
  phone?: string;
  street?: string;
  number?: string;
  complement?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Properties for updating a Customer.
 */
export interface UpdateCustomerProps {
  externalId?: string;
  name?: string;
  email?: string;
  phone?: string;
  street?: string;
  number?: string;
  complement?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

/**
 * All properties of a Customer (for reconstitution from persistence).
 */
export interface CustomerProps {
  id: string;
  storeId: string;
  externalId?: string;
  name?: string;
  email?: string;
  document: Document;
  phone?: string;
  street?: string;
  number?: string;
  complement?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Simplified object representation of a Customer (for serialization).
 */
export interface CustomerObject {
  id: string;
  storeId: string;
  externalId?: string;
  name?: string;
  email?: string;
  document: string;
  formattedDocument: string;
  documentType: 'CPF' | 'CNPJ';
  phone?: string;
  street?: string;
  number?: string;
  complement?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
