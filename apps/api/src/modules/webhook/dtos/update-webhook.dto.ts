import { IsUrl, IsArray, IsIn, IsOptional, IsBoolean } from 'class-validator';
import { ALLOWED_WEBHOOK_EVENTS } from '@hockpay/core';

/**
 * DTO for updating a webhook config.
 */
export class UpdateWebhookDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
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
