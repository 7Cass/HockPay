/**
 * Domain Entity: WebhookConfig
 *
 * Represents webhook configuration for a store.
 * Defines which events to send and where to send them.
 */
export class WebhookConfig {
  private readonly _id: string;
  private readonly _storeId: string;
  private readonly _url: string;
  private readonly _secret: string;
  private readonly _events: string[];
  private _isActive: boolean;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: WebhookConfigProps) {
    this._id = props.id;
    this._storeId = props.storeId;
    this._url = props.url;
    this._secret = props.secret;
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

  get secret(): string {
    return this._secret;
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
   * Convert to plain object.
   */
  toObject(): WebhookConfigObject {
    return {
      id: this._id,
      storeId: this._storeId,
      url: this._url,
      secret: this._secret,
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
  secret: string;
  events: string[];
}

/**
 * All properties of a WebhookConfig (for reconstitution).
 */
export interface WebhookConfigProps {
  id: string;
  storeId: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Simplified object representation.
 */
export interface WebhookConfigObject {
  id: string;
  storeId: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
