/**
 * Item DTO for store listing.
 */
export class StoreListItemDto {
  id!: string;
  name!: string;
  slug!: string;
  isActive!: boolean;
  isApproved!: boolean;
  settlementDays!: number;
  feePercent!: number;
  feeFixed!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

/**
 * Response DTO for listing stores.
 */
export class ListStoresResponseDto {
  stores!: StoreListItemDto[];
}
