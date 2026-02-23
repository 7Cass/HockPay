import {
  IWebhookConfigRepository,
  ITokenGeneratorPort,
  IEncryptionPort,
  WebhookConfig,
  WebhookConfigObject,
  InvalidWebhookEventsError,
  getInvalidEvents,
  ALLOWED_WEBHOOK_EVENTS,
} from '../..';

/**
 * Input for creating a webhook config.
 */
export interface ICreateWebhookConfigInput {
  storeId: string;
  url: string;
  events: string[];
}

/**
 * Output of creating a webhook config.
 */
export interface ICreateWebhookConfigOutput {
  webhookConfig: WebhookConfigObject;
  plainSecret: string; // whsec_xxx - shown only once!
}

/**
 * Use case for creating a new webhook configuration.
 *
 * Generates a secret, encrypts it, and stores the config.
 * Returns the plain secret only once.
 */
export class CreateWebhookConfigUseCase {
  constructor(
    private readonly webhookConfigRepository: IWebhookConfigRepository,
    private readonly tokenGenerator: ITokenGeneratorPort,
    private readonly encryption: IEncryptionPort,
  ) {}

  async execute(input: ICreateWebhookConfigInput): Promise<ICreateWebhookConfigOutput> {
    // Validate events
    const invalidEvents = getInvalidEvents(input.events);
    if (invalidEvents.length > 0) {
      throw new InvalidWebhookEventsError(invalidEvents);
    }

    // Generate plain secret: whsec_<32 chars hex> (16 bytes = 32 hex chars)
    const secretHex = this.tokenGenerator.generate(16);
    const plainSecret = `whsec_${secretHex}`;

    // Generate prefix: first 12 chars of secret (whsec_abc12...)
    const prefix = plainSecret.substring(0, 12);

    // Encrypt the secret
    const encryptedSecret = this.encryption.encrypt(plainSecret);

    // Create entity
    const webhookConfig = WebhookConfig.create({
      storeId: input.storeId,
      url: input.url,
      secret: encryptedSecret,
      prefix,
      events: input.events,
    });

    // Persist
    await this.webhookConfigRepository.save(webhookConfig);

    return {
      webhookConfig: webhookConfig.toObject(),
      plainSecret, // Returned only once!
    };
  }
}
