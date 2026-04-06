import { ReceiptObject } from "../../domain/entities/receipt.entity";
import { IReceiptRepository } from "../../domain/repositories/receipt.repository.interface";

export interface IListReceiptsInput {
  storeId: string;
  page?: number;
  limit?: number;
}

export interface IListReceiptsOutput {
  receipts: ReceiptObject[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ListReceiptsUseCase {
  constructor(private readonly receiptRepository: IReceiptRepository) {}

  async execute(input: IListReceiptsInput): Promise<IListReceiptsOutput> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const result = await this.receiptRepository.findByStoreId(
      input.storeId,
      page,
      limit,
    );

    return {
      receipts: result.items.map((r) => r.toObject()),
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }
}
