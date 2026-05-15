import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import {
  ReceiveWebhookInboxEventUseCase,
  WebhookConfigNotFoundError,
} from '@hockpay/core';
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
    try {
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
    } catch (error) {
      if (error instanceof WebhookConfigNotFoundError) {
        throw new NotFoundException({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }
      throw error;
    }
  }
}
