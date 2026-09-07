import { StoreLiveStatus } from '@hockpay/core';

/**
 * Item DTO for store listing.
 */
export class StoreListItemDto {
  id!: string;
  name!: string;
  slug!: string;
  isActive!: boolean;
  liveStatus!: StoreLiveStatus;
  liveStatusReason?: string;
  liveStatusChangedAt?: Date;
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
