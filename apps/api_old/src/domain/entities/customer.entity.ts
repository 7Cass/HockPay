/**
 * Entidade de Domínio: Customer
 *
 * Representa um cliente de uma store.
 */
export class Customer {
  private _id: string;
  private _storeId: string;
  private _externalId: string | null;
  private _name: string | null;
  private _email: string | null;
  private _document: string;
  private _phone: string | null;
  private _metadata: Record<string, unknown> | null;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: {
    id: string;
    storeId: string;
    externalId: string | null;
    name: string | null;
    email: string | null;
    document: string;
    phone: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this._id = props.id;
    this._storeId = props.storeId;
    this._externalId = props.externalId;
    this._name = props.name;
    this._email = props.email;
    this._document = props.document;
    this._phone = props.phone;
    this._metadata = props.metadata;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  // Getters
  get id(): string { return this._id; }
  get storeId(): string { return this._storeId; }
  get externalId(): string | null { return this._externalId; }
  get name(): string | null { return this._name; }
  get email(): string | null { return this._email; }
  get document(): string { return this._document; }
  get phone(): string | null { return this._phone; }
  get metadata(): Record<string, unknown> | null { return this._metadata; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  /**
   * Cria um novo customer
   */
  static create(props: {
    id: string;
    storeId: string;
    externalId: string | null;
    name: string | null;
    email: string | null;
    document: string;
    phone: string | null;
    metadata?: Record<string, unknown> | null;
  }): Customer {
    return new Customer({
      ...props,
      metadata: props.metadata ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Recria uma instância de Customer a partir de dados persistidos
   */
  static fromPersistence(props: {
    id: string;
    storeId: string;
    externalId: string | null;
    name: string | null;
    email: string | null;
    document: string;
    phone: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
  }): Customer {
    return new Customer(props);
  }

  /**
   * Atualiza os dados do customer
   */
  update(props: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    metadata?: Record<string, unknown> | null;
  }): void {
    if (props.name !== undefined) {
      this._name = props.name?.trim() ?? null;
    }

    if (props.email !== undefined) {
      this._email = props.email?.trim().toLowerCase() ?? null;
    }

    if (props.phone !== undefined) {
      this._phone = props.phone?.trim() ?? null;
    }

    if (props.metadata !== undefined) {
      this._metadata = props.metadata;
    }

    this._updatedAt = new Date();
  }

  /**
   * Retorna os dados prontos para persistência
   */
  toPersistence(): {
    id: string;
    storeId: string;
    externalId: string | null;
    name: string | null;
    email: string | null;
    document: string;
    phone: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this._id,
      storeId: this._storeId,
      externalId: this._externalId,
      name: this._name,
      email: this._email,
      document: this._document,
      phone: this._phone,
      metadata: this._metadata,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
