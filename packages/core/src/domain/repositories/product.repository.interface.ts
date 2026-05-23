import { Product } from "../entities/product.entity";
import { Environment } from "../value-objects/environment.vo";

export interface ListProductsOptions {
  storeId: string;
  environment: Environment;
  page?: number;
  limit?: number;
  externalId?: string;
  isActive?: boolean;
  search?: string;
}

export interface ListProductsResult {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IProductRepository {
  save(product: Product): Promise<void>;
  update(product: Product): Promise<void>;
  findByIdAndStoreId(
    id: string,
    storeId: string,
    environment: Environment,
  ): Promise<Product | null>;
  findActiveByIdAndStoreId(
    id: string,
    storeId: string,
    environment: Environment,
  ): Promise<Product | null>;
  findByExternalIdAndStoreId(
    externalId: string,
    storeId: string,
    environment: Environment,
  ): Promise<Product | null>;
  externalIdExists(
    externalId: string,
    storeId: string,
    environment: Environment,
    excludingProductId?: string,
  ): Promise<boolean>;
  list(options: ListProductsOptions): Promise<ListProductsResult>;
}
