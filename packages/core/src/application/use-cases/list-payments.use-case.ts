import { PaymentObject } from '../../domain/entities/payment.entity';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import {
  IPaymentRepository,
  ListPaymentsOptions,
  ListPaymentsResult,
} from '../../domain/repositories/payment.repository.interface';

/**
 * Input DTO for ListPaymentsUseCase.
 */
export interface IListPaymentsInput {
  storeId: string;
  page?: number;
  limit?: number;
  status?: PaymentStatus;
  customerId?: string;
  externalId?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Output DTO for ListPaymentsUseCase.
 */
export interface IListPaymentsOutput {
  payments: PaymentObject[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Use Case: List Payments
 *
 * This use case handles listing payments with pagination and filters.
 */
export class ListPaymentsUseCase {
  constructor(private readonly paymentRepository: IPaymentRepository) {}

  async execute(input: IListPaymentsInput): Promise<IListPaymentsOutput> {
    const options: ListPaymentsOptions = {
      storeId: input.storeId,
      page: input.page ?? 1,
      limit: Math.min(input.limit ?? 20, 100), // Max 100 per page
      status: input.status,
      customerId: input.customerId,
      externalId: input.externalId,
      startDate: input.startDate,
      endDate: input.endDate,
    };

    const result: ListPaymentsResult = await this.paymentRepository.list(options);

    return {
      payments: result.payments.map((p) => p.toObject()),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }
}
