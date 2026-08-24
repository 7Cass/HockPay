import {
  ALLOWED_WEBHOOK_EVENTS,
  getInvalidEvents,
  IEncryptionPort,
  ITokenGeneratorPort,
  IWebhookConfigRepository,
  InvalidWebhookEventsError,
  WebhookConfig,
  WebhookConfigObject,
} from '../..';

export interface ICreateWebhookInboxInput {
  storeId: string;
  baseUrl: string;
  events?: string[];
}

export interface ICreateWebhookInboxOutput {
  webhookConfig: WebhookConfigObject;
  plainSecret: string;
}

export class CreateWebhookInboxUseCase {
  constructor(
    private readonly webhookConfigRepository: IWebhookConfigRepository,
    private readonly tokenGenerator: ITokenGeneratorPort,
    private readonly encryption: IEncryptionPort,
  ) {}

  async execute(input: ICreateWebhookInboxInput): Promise<ICreateWebhookInboxOutput> {
    const events = input.events?.length ? input.events : [...ALLOWED_WEBHOOK_EVENTS];
    const invalidEvents = getInvalidEvents(events);
    if (invalidEvents.length > 0) {
      throw new InvalidWebhookEventsError(invalidEvents);
    }

    const id = crypto.randomUUID();
    const plainSecret = `whsec_${this.tokenGenerator.generate(16)}`;
    const prefix = plainSecret.substring(0, 12);
    const webhookConfig = WebhookConfig.reconstitute({
      id,
      storeId: input.storeId,
      url: `${normalizeBaseUrl(input.baseUrl)}/api/v1/dev/webhook-inbox/${id}`,
      secret: this.encryption.encrypt(plainSecret),
      prefix,
      events,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.webhookConfigRepository.save(webhookConfig);

    return {
      webhookConfig: webhookConfig.toObject(),
      plainSecret,
    };
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}
