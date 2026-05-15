import { IsArray, IsIn, IsOptional } from 'class-validator';
import { ALLOWED_WEBHOOK_EVENTS } from '@hockpay/core';

export class CreateWebhookInboxDto {
  @IsArray()
  @IsIn(ALLOWED_WEBHOOK_EVENTS, { each: true })
  @IsOptional()
  events?: string[];
}
