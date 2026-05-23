import { ProductObject } from "../../domain/entities/product.entity";
import { ProductNotFoundError } from "../../domain/errors/product-not-found.error";
import { IProductRepository } from "../../domain/repositories/product.repository.interface";
import { Environment } from "../../domain/value-objects/environment.vo";

export interface IGetProductInput {
  storeId: string;
  environment: Environment;
  productId: string;
}

export class GetProductUseCase {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(input: IGetProductInput): Promise<{ product: ProductObject }> {
    const product = await this.productRepository.findByIdAndStoreId(
      input.productId,
      input.storeId,
      input.environment,
    );
    if (!product) throw new ProductNotFoundError(input.productId);
    return { product: product.toObject() };
  }
}
