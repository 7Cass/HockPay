import {
  PaymentLink,
  PaymentLinkListItem,
  PaymentLinkStats,
  PaymentLinkStatus,
} from "../entities/payment-link.entity";
import { Environment } from "../value-objects/environment.vo";

export interface ListPaymentLinksOptions {
  storeId: string;
  page?: number;
  limit?: number;
  status?: PaymentLinkStatus;
  hasFailures?: boolean;
  environment?: Environment;
}

export interface ListPaymentLinksResult {
  items: PaymentLinkListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: PaymentLinkStats;
}

export interface IPaymentLinkRepository {
  save(link: PaymentLink): Promise<void>;
  update(link: PaymentLink): Promise<void>;
  findById(id: string): Promise<PaymentLink | null>;
  findByIdAndStoreId(id: string, storeId: string): Promise<PaymentLink | null>;
  findByIdAndStoreIdForUpdate(
    id: string,
    storeId: string,
  ): Promise<PaymentLink | null>;
  findListItemByIdAndStoreId(
    id: string,
    storeId: string,
  ): Promise<PaymentLinkListItem | null>;
  findByToken(token: string): Promise<PaymentLink | null>;
  findPublicByToken(token: string): Promise<PaymentLinkListItem | null>;
  findPublicByTokenForUpdate(token: string): Promise<PaymentLinkListItem | null>;
  list(options: ListPaymentLinksOptions): Promise<ListPaymentLinksResult>;
}
