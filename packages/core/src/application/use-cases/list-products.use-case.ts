import { ProductObject } from "../../domain/entities/product.entity";
import { IProductRepository } from "../../domain/repositories/product.repository.interface";
import { Environment } from "../../domain/value-objects/environment.vo";

export interface IListProductsInput {
  storeId: string;
  environment: Environment;
  page?: number;
  limit?: number;
  externalId?: string;
  isActive?: boolean;
  search?: string;
}

export interface IListProductsOutput {
  products: ProductObject[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ListProductsUseCase {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(input: IListProductsInput): Promise<IListProductsOutput> {
    const result = await this.productRepository.list({
      storeId: input.storeId,
      environment: input.environment,
      page: input.page,
      limit: input.limit,
      externalId: input.externalId,
      isActive: input.isActive,
      search: input.search,
    });

    return {
      products: result.products.map((product) => product.toObject()),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }
}
