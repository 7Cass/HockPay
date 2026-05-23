import { ReceiptObject } from "../../domain/entities/receipt.entity";
import { IReceiptRepository } from "../../domain/repositories/receipt.repository.interface";
import { IPaymentRepository } from "../../domain/repositories/payment.repository.interface";

export interface IListReceiptsInput {
  storeId: string;
  page?: number;
  limit?: number;
  receiptNumber?: string;
  customerId?: string;
}

export interface IListReceiptsOutput {
  receipts: ReceiptObject[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ListReceiptsUseCase {
  constructor(
    private readonly receiptRepository: IReceiptRepository,
    private readonly paymentRepository?: IPaymentRepository,
  ) {}

  async execute(input: IListReceiptsInput): Promise<IListReceiptsOutput> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const result = await this.receiptRepository.findByStoreId(
      input.storeId,
      page,
      limit,
      {
        receiptNumber: input.receiptNumber,
        customerId: input.customerId,
      },
    );

    return {
      receipts: await Promise.all(
        result.items.map(async (receipt) => {
          const object = receipt.toObject();
          if (!this.paymentRepository) return object;
          const payment = await this.paymentRepository.findByIdAndStoreId(
            receipt.paymentId,
            receipt.storeId,
          );
          return {
            ...object,
            items: payment?.items ?? [],
          };
        }),
      ),
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }
}
