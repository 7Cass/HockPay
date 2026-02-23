import { IsUrl, IsArray, ArrayNotEmpty, IsIn } from 'class-validator';
import { ALLOWED_WEBHOOK_EVENTS } from '@hockpay/core';

/**
 * DTO for creating a webhook config.
 */
export class CreateWebhookDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(ALLOWED_WEBHOOK_EVENTS, { each: true })
  events: string[];
}
