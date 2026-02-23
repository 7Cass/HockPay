/**
 * Entidade de Domínio: Store
 *
 * Representa uma loja de um merchant.
 */
export class Store {
  private _id: string;
  private _merchantId: string;
  private _name: string;
  private _slug: string;
  private _isActive: boolean;
  private _isApproved: boolean;
  private _settlementDays: number;
  private _feePercent: number;
  private _feeFixed: number;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: {
    id: string;
    merchantId: string;
    name: string;
    slug: string;
    isActive: boolean;
    isApproved: boolean;
    settlementDays: number;
    feePercent: number;
    feeFixed: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this._id = props.id;
    this._merchantId = props.merchantId;
    this._name = props.name;
    this._slug = props.slug;
    this._isActive = props.isActive;
    this._isApproved = props.isApproved;
    this._settlementDays = props.settlementDays;
    this._feePercent = props.feePercent;
    this._feeFixed = props.feeFixed;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  // Getters
  get id(): string { return this._id; }
  get merchantId(): string { return this._merchantId; }
  get name(): string { return this._name; }
  get slug(): string { return this._slug; }
  get isActive(): boolean { return this._isActive; }
  get isApproved(): boolean { return this._isApproved; }
  get settlementDays(): number { return this._settlementDays; }
  get feePercent(): number { return this._feePercent; }
  get feeFixed(): number { return this._feeFixed; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  /**
   * Cria uma nova store
   */
  static create(props: {
    id: string;
    merchantId: string;
    name: string;
    slug: string;
    settlementDays?: number;
    feePercent?: number;
    feeFixed?: number;
  }): Store {
    return new Store({
      ...props,
      isActive: true,
      isApproved: false, // Requer aprovação manual
      settlementDays: props.settlementDays ?? 30,
      feePercent: props.feePercent ?? 1.5,
      feeFixed: props.feeFixed ?? 15,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Recria uma instância de Store a partir de dados persistidos
   */
  static fromPersistence(props: {
    id: string;
    merchantId: string;
    name: string;
    slug: string;
    isActive: boolean;
    isApproved: boolean;
    settlementDays: number;
    feePercent: number;
    feeFixed: number;
    createdAt: Date;
    updatedAt: Date;
  }): Store {
    return new Store(props);
  }

  /**
   * Atualiza os dados da store
   */
  update(props: {
    name?: string;
    slug?: string;
    settlementDays?: number;
    feePercent?: number;
    feeFixed?: number;
  }): void {
    if (props.name !== undefined) {
      if (!props.name || props.name.trim().length === 0) {
        throw new Error('Name cannot be empty');
      }
      this._name = props.name.trim();
    }

    if (props.slug !== undefined) {
      if (!props.slug || props.slug.trim().length === 0) {
        throw new Error('Slug cannot be empty');
      }
      this._slug = props.slug.trim().toLowerCase();
    }

    if (props.settlementDays !== undefined) {
      if (props.settlementDays < 0) {
        throw new Error('Settlement days cannot be negative');
      }
      this._settlementDays = props.settlementDays;
    }

    if (props.feePercent !== undefined) {
      if (props.feePercent < 0 || props.feePercent > 100) {
        throw new Error('Fee percent must be between 0 and 100');
      }
      this._feePercent = props.feePercent;
    }

    if (props.feeFixed !== undefined) {
      if (props.feeFixed < 0) {
        throw new Error('Fee fixed cannot be negative');
      }
      this._feeFixed = props.feeFixed;
    }

    this._updatedAt = new Date();
  }

  /**
   * Ativa a store
   */
  activate(): void {
    if (this._isActive) {
      return;
    }
    this._isActive = true;
    this._updatedAt = new Date();
  }

  /**
   * Desativa a store
   */
  deactivate(): void {
    if (!this._isActive) {
      return;
    }
    this._isActive = false;
    this._updatedAt = new Date();
  }

  /**
   * Aprova a store
   */
  approve(): void {
    if (this._isApproved) {
      return;
    }
    this._isApproved = true;
    this._updatedAt = new Date();
  }

  /**
   * Verifica se a store pode processar pagamentos
   */
  canProcessPayments(): boolean {
    return this._isActive && this._isApproved;
  }

  /**
   * Retorna os dados prontos para persistência
   */
  toPersistence(): {
    id: string;
    merchantId: string;
    name: string;
    slug: string;
    isActive: boolean;
    isApproved: boolean;
    settlementDays: number;
    feePercent: number;
    feeFixed: number;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this._id,
      merchantId: this._merchantId,
      name: this._name,
      slug: this._slug,
      isActive: this._isActive,
      isApproved: this._isApproved,
      settlementDays: this._settlementDays,
      feePercent: this._feePercent,
      feeFixed: this._feeFixed,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
