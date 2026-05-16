import { IsArray, ArrayNotEmpty, IsIn } from 'class-validator';
import { ALLOWED_WEBHOOK_EVENTS } from '@hockpay/core';
import { IsWebhookUrl } from './webhook-url.validator';

/**
 * DTO for creating a webhook config.
 */
export class CreateWebhookDto {
  @IsWebhookUrl()
  url: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(ALLOWED_WEBHOOK_EVENTS, { each: true })
  events: string[];
}
