import { Environment } from '../value-objects/environment.vo';
import { InvalidProductError } from '../errors/invalid-product.error';

export interface ProductProps {
  id?: string;
  storeId: string;
  externalId?: string;
  name: string;
  description?: string;
  price: number;
  currency?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
  environment?: Environment;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductObject {
  id: string;
  storeId: string;
  externalId?: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
  environment: Environment;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Product {
  private readonly _id: string;
  private readonly _storeId: string;
  private _externalId?: string;
  private _name: string;
  private _description?: string;
  private _price: number;
  private readonly _currency: string;
  private _imageUrl?: string;
  private _metadata?: Record<string, unknown>;
  private readonly _environment: Environment;
  private _isActive: boolean;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: ProductProps) {
    const now = new Date();
    this._id = props.id ?? crypto.randomUUID();
    this._storeId = props.storeId;
    this._externalId = normalizeOptionalString(props.externalId);
    this._name = validateName(props.name);
    this._description = normalizeOptionalString(props.description);
    this._price = validatePrice(props.price);
    this._currency = validateCurrency(props.currency ?? 'BRL');
    this._imageUrl = normalizeOptionalString(props.imageUrl);
    this._metadata = props.metadata;
    this._environment = props.environment ?? Environment.TEST;
    this._isActive = props.isActive ?? true;
    this._createdAt = props.createdAt ?? now;
    this._updatedAt = props.updatedAt ?? now;
  }

  static create(props: ProductProps): Product {
    return new Product(props);
  }

  static reconstitute(props: ProductProps): Product {
    return new Product(props);
  }

  get id(): string {
    return this._id;
  }
  get storeId(): string {
    return this._storeId;
  }
  get externalId(): string | undefined {
    return this._externalId;
  }
  get name(): string {
    return this._name;
  }
  get description(): string | undefined {
    return this._description;
  }
  get price(): number {
    return this._price;
  }
  get currency(): string {
    return this._currency;
  }
  get imageUrl(): string | undefined {
    return this._imageUrl;
  }
  get metadata(): Record<string, unknown> | undefined {
    return this._metadata;
  }
  get environment(): Environment {
    return this._environment;
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

  update(input: {
    externalId?: string | null;
    name?: string;
    description?: string | null;
    price?: number;
    imageUrl?: string | null;
    metadata?: Record<string, unknown> | null;
    isActive?: boolean;
  }): void {
    if (input.externalId !== undefined) {
      this._externalId = normalizeOptionalString(input.externalId ?? undefined);
    }
    if (input.name !== undefined) {
      this._name = validateName(input.name);
    }
    if (input.description !== undefined) {
      this._description = normalizeOptionalString(input.description ?? undefined);
    }
    if (input.price !== undefined) {
      this._price = validatePrice(input.price);
    }
    if (input.imageUrl !== undefined) {
      this._imageUrl = normalizeOptionalString(input.imageUrl ?? undefined);
    }
    if (input.metadata !== undefined) {
      this._metadata = input.metadata ?? undefined;
    }
    if (input.isActive !== undefined) {
      this._isActive = input.isActive;
    }
    this._updatedAt = new Date();
  }

  toObject(): ProductObject {
    return {
      id: this._id,
      storeId: this._storeId,
      externalId: this._externalId,
      name: this._name,
      description: this._description,
      price: this._price,
      currency: this._currency,
      imageUrl: this._imageUrl,
      metadata: this._metadata,
      environment: this._environment,
      isActive: this._isActive,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}

function normalizeOptionalString(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function validateName(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new InvalidProductError('Product name is required');
  if (normalized.length > 120)
    throw new InvalidProductError('Product name cannot exceed 120 characters');
  return normalized;
}

function validatePrice(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new InvalidProductError('Product price must be at least 1 cent');
  }
  if (value > 9999999999) {
    throw new InvalidProductError('Product price cannot exceed 99,999,999.99 BRL');
  }
  return value;
}

function validateCurrency(value: string): string {
  if (value !== 'BRL') throw new InvalidProductError('Product currency must be BRL');
  return value;
}
