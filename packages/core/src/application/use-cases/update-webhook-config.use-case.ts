import {
  IWebhookConfigRepository,
  WebhookConfig,
  WebhookConfigNotFoundError,
  InvalidWebhookEventsError,
  WebhookUrlPolicyOptions,
  assertWebhookUrlAllowed,
  getInvalidEvents,
  UpdateWebhookConfigProps,
} from "../..";

/**
 * Input for updating a webhook config.
 */
export interface IUpdateWebhookConfigInput {
  configId: string;
  storeId: string;
  url?: string;
  events?: string[];
  isActive?: boolean;
}

/**
 * Output of updating a webhook config.
 */
export interface IUpdateWebhookConfigOutput {
  webhookConfig: WebhookConfig;
}

/**
 * Use case for updating a webhook configuration.
 */
export class UpdateWebhookConfigUseCase {
  constructor(
    private readonly webhookConfigRepository: IWebhookConfigRepository,
    private readonly webhookUrlPolicyOptions: WebhookUrlPolicyOptions = {},
  ) {}

  async execute(
    input: IUpdateWebhookConfigInput,
  ): Promise<IUpdateWebhookConfigOutput> {
    const webhookConfig = await this.webhookConfigRepository.findById(
      input.configId,
    );

    if (!webhookConfig) {
      throw new WebhookConfigNotFoundError(input.configId);
    }

    // Validate ownership
    if (webhookConfig.storeId !== input.storeId) {
      throw new WebhookConfigNotFoundError(input.configId);
    }

    // Validate events if provided
    if (input.events !== undefined) {
      const invalidEvents = getInvalidEvents(input.events);
      if (invalidEvents.length > 0) {
        throw new InvalidWebhookEventsError(invalidEvents);
      }
    }

    // Build update props
    const updateProps: UpdateWebhookConfigProps = {};
    if (input.url !== undefined) {
      assertWebhookUrlAllowed(input.url, this.webhookUrlPolicyOptions);
      updateProps.url = input.url;
    }
    if (input.events !== undefined) {
      updateProps.events = input.events;
    }
    if (input.isActive !== undefined) {
      updateProps.isActive = input.isActive;
    }

    // Update entity
    webhookConfig.update(updateProps);

    // Persist
    await this.webhookConfigRepository.update(webhookConfig);

    return { webhookConfig };
  }
}
