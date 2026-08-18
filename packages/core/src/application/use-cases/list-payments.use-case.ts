import { PaymentObject } from '../../domain/entities/payment.entity';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import { Environment } from '../../domain/value-objects/environment.vo';
import {
  IPaymentRepository,
  ListPaymentsOptions,
  ListPaymentsResult,
} from '../../domain/repositories/payment.repository.interface';
import { enrichPaymentAttempts } from '../services/payment-attempt-context.service';

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
  environment?: Environment;
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
      environment: input.environment,
    };

    const result: ListPaymentsResult = await this.paymentRepository.list(options);

    const payments = result.payments.map((p) => p.toObject());
    const pixChargeIds = payments
      .map((payment) => payment.pixChargeId)
      .filter((pixChargeId): pixChargeId is string => Boolean(pixChargeId));
    const relatedAttempts = await this.paymentRepository.listByPixChargeIdsAndStoreId(
      pixChargeIds,
      input.storeId,
    );
    const relatedAttemptObjects = relatedAttempts.map((payment) =>
      payment.toObject(),
    );
    const enrichedAttempts = enrichPaymentAttempts([
      ...relatedAttemptObjects,
      ...payments.filter(
        (payment) =>
          !relatedAttemptObjects.some((attempt) => attempt.id === payment.id),
      ),
    ]);
    const enrichedById = new Map(
      enrichedAttempts.map((payment) => [payment.id, payment]),
    );

    return {
      payments: payments.map((payment) => enrichedById.get(payment.id) ?? payment),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }
}
