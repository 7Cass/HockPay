import { IsUrl, IsArray, ArrayNotEmpty, IsIn, Matches } from 'class-validator';
import { ALLOWED_WEBHOOK_EVENTS } from '@hockpay/core';

/**
 * DTO for creating a webhook config.
 */
export class CreateWebhookDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  @Matches(/^https:\/\/|^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/, {
    message: 'url must use HTTPS or local HTTP on localhost/127.0.0.1',
  })
  url: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(ALLOWED_WEBHOOK_EVENTS, { each: true })
  events: string[];
}
