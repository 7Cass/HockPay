import { PaymentObject } from '../../domain/entities/payment.entity';
import { PaymentStatus } from '../../domain/enums/payment-status.enum';
import { Environment } from '../../domain/value-objects/environment.vo';
import { ICustomerRepository } from '../../domain/repositories/customer.repository.interface';
import { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';
import { resolveCustomerByExternalId } from './customer-history.helpers';

export interface IListCustomerHistoryPaymentsInput {
  storeId: string;
  customerExternalId: string;
  page?: number;
  limit?: number;
  status?: PaymentStatus;
  startDate?: Date;
  endDate?: Date;
  environment: Environment;
}

export interface IListCustomerHistoryPaymentsOutput {
  payments: PaymentObject[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ListCustomerHistoryPaymentsUseCase {
  constructor(
    private readonly customerRepository: ICustomerRepository,
    private readonly paymentRepository: IPaymentRepository,
  ) {}

  async execute(
    input: IListCustomerHistoryPaymentsInput,
  ): Promise<IListCustomerHistoryPaymentsOutput> {
    const customer = await resolveCustomerByExternalId(
      this.customerRepository,
      input.storeId,
      input.customerExternalId,
    );

    const page = input.page ?? 1;
    const limit = Math.min(input.limit ?? 20, 100);

    const result = await this.paymentRepository.list({
      storeId: input.storeId,
      customerId: customer.id,
      page,
      limit,
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate,
      environment: input.environment,
    });

    return {
      payments: result.payments.map((payment) => payment.toObject()),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }
}
