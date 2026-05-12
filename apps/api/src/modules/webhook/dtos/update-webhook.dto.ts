import { IsUrl, IsArray, IsIn, IsOptional, IsBoolean, Matches } from 'class-validator';
import { ALLOWED_WEBHOOK_EVENTS } from '@hockpay/core';

/**
 * DTO for updating a webhook config.
 */
export class UpdateWebhookDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  @Matches(/^https:\/\/|^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/, {
    message: 'url must use HTTPS or local HTTP on localhost/127.0.0.1',
  })
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
