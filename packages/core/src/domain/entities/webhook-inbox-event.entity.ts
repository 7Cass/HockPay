/**
 * Domain Entity: WebhookInboxEvent
 *
 * Represents a webhook payload received by the internal test inbox.
 */
export class WebhookInboxEvent {
  private readonly _id: string;
  private readonly _storeId: string;
  private readonly _configId: string;
  private readonly _eventType: string;
  private readonly _payload: Record<string, unknown>;
  private readonly _requestHeaders?: Record<string, string>;
  private readonly _requestId?: string;
  private readonly _deliveryId?: string;
  private readonly _outboxEventId?: string;
  private readonly _paymentId?: string;
  private readonly _signatureValid: boolean;
  private readonly _receivedAt: Date;

  private constructor(props: WebhookInboxEventProps) {
    this._id = props.id;
    this._storeId = props.storeId;
    this._configId = props.configId;
    this._eventType = props.eventType;
    this._payload = props.payload;
    this._requestHeaders = props.requestHeaders;
    this._requestId = props.requestId;
    this._deliveryId = props.deliveryId;
    this._outboxEventId = props.outboxEventId;
    this._paymentId = props.paymentId;
    this._signatureValid = props.signatureValid;
    this._receivedAt = props.receivedAt;
  }

  static create(props: CreateWebhookInboxEventProps): WebhookInboxEvent {
    return new WebhookInboxEvent({
      id: crypto.randomUUID(),
      receivedAt: new Date(),
      ...props,
    });
  }

  static reconstitute(props: WebhookInboxEventProps): WebhookInboxEvent {
    return new WebhookInboxEvent(props);
  }

  get id(): string {
    return this._id;
  }

  get storeId(): string {
    return this._storeId;
  }

  get configId(): string {
    return this._configId;
  }

  get eventType(): string {
    return this._eventType;
  }

  get payload(): Record<string, unknown> {
    return this._payload;
  }

  get requestHeaders(): Record<string, string> | undefined {
    return this._requestHeaders;
  }

  get requestId(): string | undefined {
    return this._requestId;
  }

  get deliveryId(): string | undefined {
    return this._deliveryId;
  }

  get outboxEventId(): string | undefined {
    return this._outboxEventId;
  }

  get paymentId(): string | undefined {
    return this._paymentId;
  }

  get signatureValid(): boolean {
    return this._signatureValid;
  }

  get receivedAt(): Date {
    return this._receivedAt;
  }

  toObject(): WebhookInboxEventObject {
    return {
      id: this._id,
      storeId: this._storeId,
      configId: this._configId,
      eventType: this._eventType,
      payload: this._payload,
      requestHeaders: this._requestHeaders,
      requestId: this._requestId,
      deliveryId: this._deliveryId,
      outboxEventId: this._outboxEventId,
      paymentId: this._paymentId,
      signatureValid: this._signatureValid,
      receivedAt: this._receivedAt,
    };
  }
}

export interface CreateWebhookInboxEventProps {
  storeId: string;
  configId: string;
  eventType: string;
  payload: Record<string, unknown>;
  requestHeaders?: Record<string, string>;
  requestId?: string;
  deliveryId?: string;
  outboxEventId?: string;
  paymentId?: string;
  signatureValid: boolean;
}

export interface WebhookInboxEventProps extends CreateWebhookInboxEventProps {
  id: string;
  receivedAt: Date;
}

export interface WebhookInboxEventObject extends WebhookInboxEventProps {}
