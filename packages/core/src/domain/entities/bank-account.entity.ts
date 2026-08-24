export enum PixKeyType {
  CPF = 'CPF',
  CNPJ = 'CNPJ',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  RANDOM = 'RANDOM',
}

export interface BankAccountProps {
  id: string;
  storeId: string;
  pixKey: string;
  pixKeyType: PixKeyType;
  holderName: string;
  holderDocument: string; // The CPF/CNPJ of the key owner
  isDefault: boolean;
  isVerified: boolean; // Auto-verified if CPF/CNPJ matches the merchant document
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBankAccountProps {
  storeId: string;
  pixKey: string;
  pixKeyType: PixKeyType;
  holderName: string;
  holderDocument: string;
  isDefault?: boolean;
}

/**
 * Domain Entity: BankAccount
 * Represents a withdrawal destination account tied to a Store.
 */
export class BankAccount {
  private readonly _id: string;
  private readonly _storeId: string;
  private readonly _pixKey: string;
  private readonly _pixKeyType: PixKeyType;
  private readonly _holderName: string;
  private readonly _holderDocument: string;
  private _isDefault: boolean;
  private _isVerified: boolean;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: BankAccountProps) {
    this._id = props.id;
    this._storeId = props.storeId;
    this._pixKey = props.pixKey;
    this._pixKeyType = props.pixKeyType;
    this._holderName = props.holderName;
    this._holderDocument = props.holderDocument;
    this._isDefault = props.isDefault;
    this._isVerified = props.isVerified;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(props: CreateBankAccountProps): BankAccount {
    return new BankAccount({
      id: crypto.randomUUID(),
      storeId: props.storeId,
      pixKey: props.pixKey,
      pixKeyType: props.pixKeyType,
      holderName: props.holderName,
      holderDocument: props.holderDocument,
      isDefault: props.isDefault ?? false,
      isVerified: false, // Will be set by UseCase based on business rules
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: BankAccountProps): BankAccount {
    return new BankAccount(props);
  }

  get id(): string {
    return this._id;
  }
  get storeId(): string {
    return this._storeId;
  }
  get pixKey(): string {
    return this._pixKey;
  }
  get pixKeyType(): PixKeyType {
    return this._pixKeyType;
  }
  get holderName(): string {
    return this._holderName;
  }
  get holderDocument(): string {
    return this._holderDocument;
  }
  get isDefault(): boolean {
    return this._isDefault;
  }
  get isVerified(): boolean {
    return this._isVerified;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Domain rules verify the PIX key automatically if certain conditions are met.
   */
  verify(): void {
    this._isVerified = true;
    this._touch();
  }

  markAsDefault(): void {
    this._isDefault = true;
    this._touch();
  }

  unmarkAsDefault(): void {
    this._isDefault = false;
    this._touch();
  }

  private _touch(): void {
    this._updatedAt = new Date();
  }

  toObject(): object {
    return {
      id: this._id,
      storeId: this._storeId,
      pixKey: this._pixKey,
      pixKeyType: this._pixKeyType,
      holderName: this._holderName,
      holderDocument: this._holderDocument,
      isDefault: this._isDefault,
      isVerified: this._isVerified,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
