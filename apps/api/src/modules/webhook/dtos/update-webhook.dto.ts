import { IsArray, IsIn, IsOptional, IsBoolean } from 'class-validator';
import { ALLOWED_WEBHOOK_EVENTS } from '@hockpay/core';
import { IsWebhookUrl } from './webhook-url.validator';

/**
 * DTO for updating a webhook config.
 */
export class UpdateWebhookDto {
  @IsWebhookUrl()
  @IsOptional()
  url?: string;

  @IsArray()
  @IsIn(ALLOWED_WEBHOOK_EVENTS, { each: true })
  @IsOptional()
  events?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
