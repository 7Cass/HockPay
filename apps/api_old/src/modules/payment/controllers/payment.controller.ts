import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { CurrentStore, ApiKeyGuard } from '../../auth';
import { PaymentService } from '../payment.service';
import { CreatePaymentDTO, PaymentResponseDTO } from '../dto/create-payment.dto';

/**
 * Controller de Pagamentos
 *
 * Gerencia a criação e consulta de pagamentos Pix
 */
@UseGuards(ApiKeyGuard)
@Controller('v1/payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
  ) {}

  /**
   * Cria um novo pagamento Pix
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentStore() store: { id: string },
    @Body() dto: CreatePaymentDTO,
  ): Promise<PaymentResponseDTO> {
    return this.paymentService.create(store.id, dto);
  }

  /**
   * Busca um pagamento por ID
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentStore() store: { id: string },
  ): Promise<PaymentResponseDTO | null> {
    return this.paymentService.findById(id, store.id);
  }
}
