/**
 * Domain Entity: WebhookConfig
 *
 * Represents webhook configuration for a store.
 * Defines which events to send and where to send them.
 */
export class WebhookConfig {
  private readonly _id: string;
  private readonly _storeId: string;
  private _url: string;
  private readonly _secret: string; // Encrypted secret
  private readonly _prefix: string; // First 12 chars of plain secret for identification
  private _events: string[];
  private _isActive: boolean;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: WebhookConfigProps) {
    this._id = props.id;
    this._storeId = props.storeId;
    this._url = props.url;
    this._secret = props.secret;
    this._prefix = props.prefix;
    this._events = props.events;
    this._isActive = props.isActive;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  /**
   * Factory method to create a new WebhookConfig.
   */
  static create(props: CreateWebhookConfigProps): WebhookConfig {
    return new WebhookConfig({
      id: crypto.randomUUID(),
      storeId: props.storeId,
      url: props.url,
      secret: props.secret,
      prefix: props.prefix,
      events: props.events,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Factory method to reconstitute from persistence.
   */
  static reconstitute(props: WebhookConfigProps): WebhookConfig {
    return new WebhookConfig(props);
  }

  // Getters

  get id(): string {
    return this._id;
  }

  get storeId(): string {
    return this._storeId;
  }

  get url(): string {
    return this._url;
  }

  /**
   * Returns the encrypted secret.
   * Use IEncryptionPort.decrypt() to get the plain secret.
   */
  get secret(): string {
    return this._secret;
  }

  /**
   * Returns the prefix (first 12 chars of the plain secret).
   * Used for identification without exposing the full secret.
   */
  get prefix(): string {
    return this._prefix;
  }

  get events(): string[] {
    return [...this._events];
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

  // Business methods

  /**
   * Update webhook config properties.
   */
  update(props: UpdateWebhookConfigProps): void {
    if (props.url !== undefined) {
      this._url = props.url;
    }
    if (props.events !== undefined) {
      this._events = props.events;
    }
    if (props.isActive !== undefined) {
      this._isActive = props.isActive;
    }
    this._updatedAt = new Date();
  }

  /**
   * Check if this config should receive a specific event.
   */
  shouldReceiveEvent(eventType: string): boolean {
    return this._isActive && this._events.includes(eventType);
  }

  /**
   * Activate the webhook config.
   */
  activate(): void {
    this._isActive = true;
    this._updatedAt = new Date();
  }

  /**
   * Deactivate the webhook config.
   */
  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }

  /**
   * Convert to plain object (includes encrypted secret).
   */
  toObject(): WebhookConfigObject {
    return {
      id: this._id,
      storeId: this._storeId,
      url: this._url,
      secret: this._secret,
      prefix: this._prefix,
      events: this._events,
      isActive: this._isActive,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  /**
   * Convert to public object (excludes secret).
   */
  toPublicObject(): WebhookConfigPublicObject {
    return {
      id: this._id,
      storeId: this._storeId,
      url: this._url,
      prefix: this._prefix,
      events: this._events,
      isActive: this._isActive,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}

/**
 * Properties needed to create a new WebhookConfig.
 */
export interface CreateWebhookConfigProps {
  storeId: string;
  url: string;
  secret: string; // Encrypted secret
  prefix: string; // First 12 chars of plain secret
  events: string[];
}

/**
 * Properties for updating a WebhookConfig.
 */
export interface UpdateWebhookConfigProps {
  url?: string;
  events?: string[];
  isActive?: boolean;
}

/**
 * All properties of a WebhookConfig (for reconstitution).
 */
export interface WebhookConfigProps {
  id: string;
  storeId: string;
  url: string;
  secret: string;
  prefix: string;
  events: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Simplified object representation (includes encrypted secret).
 */
export interface WebhookConfigObject {
  id: string;
  storeId: string;
  url: string;
  secret: string;
  prefix: string;
  events: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Public object representation (excludes secret).
 */
export interface WebhookConfigPublicObject {
  id: string;
  storeId: string;
  url: string;
  prefix: string;
  events: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
