import { ReceiptObject } from '../../domain/entities/receipt.entity';
import { ICustomerRepository } from '../../domain/repositories/customer.repository.interface';
import { IReceiptRepository } from '../../domain/repositories/receipt.repository.interface';
import { resolveCustomerByExternalId } from './customer-history.helpers';

export interface IListCustomerHistoryReceiptsInput {
  storeId: string;
  customerExternalId: string;
  page?: number;
  limit?: number;
  receiptNumber?: string;
}

export interface IListCustomerHistoryReceiptsOutput {
  receipts: ReceiptObject[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ListCustomerHistoryReceiptsUseCase {
  constructor(
    private readonly customerRepository: ICustomerRepository,
    private readonly receiptRepository: IReceiptRepository,
  ) {}

  async execute(
    input: IListCustomerHistoryReceiptsInput,
  ): Promise<IListCustomerHistoryReceiptsOutput> {
    const customer = await resolveCustomerByExternalId(
      this.customerRepository,
      input.storeId,
      input.customerExternalId,
    );

    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const result = await this.receiptRepository.findByStoreId(
      input.storeId,
      page,
      limit,
      {
        receiptNumber: input.receiptNumber,
        customerId: customer.id,
      },
    );

    return {
      receipts: result.items.map((receipt) => receipt.toObject()),
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }
}
