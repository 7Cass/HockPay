import { Controller, Post, Param, HttpCode, HttpStatus, UseGuards, Query } from '@nestjs/common';
import { ApiKeyGuard } from '../../auth';
import { PaymentService } from '../payment.service';
import { PaymentResponseDTO } from '../dto/create-payment.dto';

/**
 * Controller de Simulações (Dev Mode)
 *
 * Endpoints para simular estados de pagamento
 * Apenas disponível em ambiente de teste
 */
@UseGuards(ApiKeyGuard)
@Controller('v1/dev')
export class DevController {
  constructor(
    private readonly paymentService: PaymentService,
  ) {}

  /**
   * Simula a confirmação de um pagamento
   */
  @Post('simulate/:id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @Param('id') id: string,
    @Query('pixTxId') pixTxId?: string,
  ): Promise<PaymentResponseDTO> {
    return this.paymentService.confirm(id, pixTxId);
  }

  /**
   * Simula a expiração de um pagamento
   */
  @Post('simulate/:id/expire')
  @HttpCode(HttpStatus.OK)
  async expire(@Param('id') id: string): Promise<PaymentResponseDTO> {
    return this.paymentService.expire(id);
  }

  /**
   * Simula a falha de um pagamento
   */
  @Post('simulate/:id/fail')
  @HttpCode(HttpStatus.OK)
  async fail(
    @Param('id') id: string,
    @Query('reason') reason?: string,
  ): Promise<PaymentResponseDTO> {
    return this.paymentService.fail(id, reason || 'Payment failed');
  }
}
