/**
 * Item DTO for store listing.
 */
export class StoreListItemDto {
  id!: string;
  name!: string;
  slug!: string;
  isActive!: boolean;
  isApproved!: boolean;
  createdAt!: Date;
}

/**
 * Response DTO for listing stores.
 */
export class ListStoresResponseDto {
  stores!: StoreListItemDto[];
}
