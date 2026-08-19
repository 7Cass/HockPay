import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ReceiveWebhookInboxEventUseCase } from '@hockpay/core';
import { Public } from '../auth/decorators/public.decorator';

@Controller('dev/webhook-inbox')
@Public()
export class WebhookInboxController {
  constructor(
    private readonly receiveWebhookInboxEventUseCase: ReceiveWebhookInboxEventUseCase,
  ) {}

  @Post(':configId')
  @HttpCode(HttpStatus.OK)
  async receive(
    @Param('configId') configId: string,
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const result = await this.receiveWebhookInboxEventUseCase.execute({
      configId,
      payload,
      headers,
    });

    if (!result.event.signatureValid) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_WEBHOOK_SIGNATURE',
          message: 'Webhook signature is missing or invalid.',
        },
      });
    }

    return {
      received: true,
      eventId: result.event.id,
    };
  }
}
