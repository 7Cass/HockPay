import { IStoreRepository } from '../../domain/repositories/store.repository.interface';

/**
 * Item representation for store listing.
 */
export interface StoreListItem {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  isApproved: boolean;
  settlementDays: number;
  feePercent: number;
  feeFixed: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input DTO for ListStoresUseCase.
 */
export interface IListStoresInput {
  merchantId: string;
}

/**
 * Output DTO for ListStoresUseCase.
 */
export interface IListStoresOutput {
  stores: StoreListItem[];
}

/**
 * Use Case: List Stores
 *
 * This use case handles listing all stores for a merchant.
 */
export class ListStoresUseCase {
  constructor(private readonly storeRepository: IStoreRepository) {}

  async execute(input: IListStoresInput): Promise<IListStoresOutput> {
    const stores = await this.storeRepository.findByMerchantId(input.merchantId);

    return {
      stores: stores.map((store) => ({
        id: store.id,
        name: store.name,
        slug: store.slug,
        isActive: store.isActive,
        isApproved: store.isApproved,
        settlementDays: store.settlementDays,
        feePercent: store.feePercent,
        feeFixed: store.feeFixed,
        createdAt: store.createdAt,
        updatedAt: store.updatedAt,
      })),
    };
  }
}
