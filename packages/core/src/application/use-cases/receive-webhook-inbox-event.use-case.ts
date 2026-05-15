import {
  IEncryptionPort,
  IHmacSignerPort,
  IWebhookConfigRepository,
  IWebhookInboxEventRepository,
  WebhookConfigNotFoundError,
  WebhookInboxEvent,
  WebhookInboxEventObject,
} from "../..";

export interface IReceiveWebhookInboxEventInput {
  configId: string;
  payload: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
}

export interface IReceiveWebhookInboxEventOutput {
  event: WebhookInboxEventObject;
}

export class ReceiveWebhookInboxEventUseCase {
  constructor(
    private readonly webhookConfigRepository: IWebhookConfigRepository,
    private readonly webhookInboxEventRepository: IWebhookInboxEventRepository,
    private readonly hmacSigner: IHmacSignerPort,
    private readonly encryption: IEncryptionPort,
  ) {}

  async execute(
    input: IReceiveWebhookInboxEventInput,
  ): Promise<IReceiveWebhookInboxEventOutput> {
    const config = await this.webhookConfigRepository.findById(input.configId);
    if (!config || !config.isActive) {
      throw new WebhookConfigNotFoundError(input.configId);
    }

    const normalizedHeaders = normalizeHeaders(input.headers);
    const signature = normalizedHeaders["x-hockpay-signature"];
    const timestamp = Number(normalizedHeaders["x-hockpay-timestamp"]);
    const plainSecret = this.encryption.decrypt(config.secret);
    const signatureValid =
      Boolean(signature) &&
      Number.isFinite(timestamp) &&
      this.hmacSigner.sign(plainSecret, input.payload, timestamp) === signature;

    const eventType =
      typeof input.payload.type === "string"
        ? input.payload.type
        : input.payload.test === true
          ? "webhook.test"
          : "unknown";
    const data =
      input.payload.data &&
      typeof input.payload.data === "object" &&
      !Array.isArray(input.payload.data)
        ? (input.payload.data as Record<string, unknown>)
        : undefined;

    const event = WebhookInboxEvent.create({
      storeId: config.storeId,
      configId: config.id,
      eventType,
      payload: input.payload,
      requestHeaders: normalizedHeaders,
      requestId: normalizedHeaders["x-request-id"],
      deliveryId: normalizedHeaders["x-hockpay-webhook-id"],
      outboxEventId:
        typeof input.payload.id === "string" ? input.payload.id : undefined,
      paymentId: typeof data?.id === "string" ? data.id : undefined,
      signatureValid,
    });

    await this.webhookInboxEventRepository.save(event);

    return { event: event.toObject() };
  }
}

function normalizeHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers)
      .map(([key, value]) => [
        key.toLowerCase(),
        Array.isArray(value) ? value.join(", ") : value,
      ])
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
  );
}
