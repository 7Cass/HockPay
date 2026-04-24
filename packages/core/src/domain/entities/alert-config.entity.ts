export type AlertChannel = 'discord';

export interface AlertConfigPreview {
  webhookUrl: string;
}

export interface DiscordAlertEncryptedConfig {
  webhookUrl: string;
}

export interface AlertEncryptedConfig {
  discord: DiscordAlertEncryptedConfig;
}

/**
 * Domain Entity: AlertConfig
 *
 * Represents an operational alert configuration for a store team.
 * Public webhooks are integration contracts; alerts are internal notifications.
 */
export class AlertConfig {
  private readonly _id: string;
  private readonly _storeId: string;
  private _name: string;
  private readonly _channel: AlertChannel;
  private _encryptedConfig: AlertEncryptedConfig;
  private _configPreview: AlertConfigPreview;
  private _events: string[];
  private _isActive: boolean;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: AlertConfigProps) {
    this._id = props.id;
    this._storeId = props.storeId;
    this._name = props.name;
    this._channel = props.channel;
    this._encryptedConfig = props.encryptedConfig;
    this._configPreview = props.configPreview;
    this._events = props.events;
    this._isActive = props.isActive;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  static create(props: CreateAlertConfigProps): AlertConfig {
    return new AlertConfig({
      id: crypto.randomUUID(),
      storeId: props.storeId,
      name: props.name,
      channel: props.channel,
      encryptedConfig: props.encryptedConfig,
      configPreview: props.configPreview,
      events: props.events,
      isActive: props.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: AlertConfigProps): AlertConfig {
    return new AlertConfig(props);
  }

  get id(): string {
    return this._id;
  }

  get storeId(): string {
    return this._storeId;
  }

  get name(): string {
    return this._name;
  }

  get channel(): AlertChannel {
    return this._channel;
  }

  get encryptedConfig(): AlertEncryptedConfig {
    return {
      discord: { ...this._encryptedConfig.discord },
    };
  }

  get configPreview(): AlertConfigPreview {
    return { ...this._configPreview };
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

  update(props: UpdateAlertConfigProps): void {
    if (props.name !== undefined) {
      this._name = props.name;
    }
    if (props.encryptedConfig !== undefined) {
      this._encryptedConfig = props.encryptedConfig;
    }
    if (props.configPreview !== undefined) {
      this._configPreview = props.configPreview;
    }
    if (props.events !== undefined) {
      this._events = props.events;
    }
    if (props.isActive !== undefined) {
      this._isActive = props.isActive;
    }
    this._updatedAt = new Date();
  }

  shouldReceiveEvent(eventType: string): boolean {
    return this._isActive && this._events.includes(eventType);
  }

  toObject(): AlertConfigObject {
    return {
      id: this._id,
      storeId: this._storeId,
      name: this._name,
      channel: this._channel,
      encryptedConfig: this.encryptedConfig,
      configPreview: this.configPreview,
      events: this.events,
      isActive: this._isActive,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  toPublicObject(): AlertConfigPublicObject {
    return {
      id: this._id,
      storeId: this._storeId,
      name: this._name,
      channel: this._channel,
      configPreview: this.configPreview,
      events: this.events,
      isActive: this._isActive,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}

export interface CreateAlertConfigProps {
  storeId: string;
  name: string;
  channel: AlertChannel;
  encryptedConfig: AlertEncryptedConfig;
  configPreview: AlertConfigPreview;
  events: string[];
  isActive?: boolean;
}

export interface UpdateAlertConfigProps {
  name?: string;
  encryptedConfig?: AlertEncryptedConfig;
  configPreview?: AlertConfigPreview;
  events?: string[];
  isActive?: boolean;
}

export interface AlertConfigProps extends CreateAlertConfigProps {
  id: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertConfigObject extends AlertConfigProps {}

export interface AlertConfigPublicObject {
  id: string;
  storeId: string;
  name: string;
  channel: AlertChannel;
  configPreview: AlertConfigPreview;
  events: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
