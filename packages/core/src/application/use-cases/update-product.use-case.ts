import { ProductObject } from "../../domain/entities/product.entity";
import { ProductExternalIdAlreadyExistsError } from "../../domain/errors/product-external-id-already-exists.error";
import { ProductNotFoundError } from "../../domain/errors/product-not-found.error";
import { IProductRepository } from "../../domain/repositories/product.repository.interface";
import { Environment } from "../../domain/value-objects/environment.vo";

export interface IUpdateProductInput {
  storeId: string;
  environment: Environment;
  productId: string;
  externalId?: string | null;
  name?: string;
  description?: string | null;
  price?: number;
  imageUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  isActive?: boolean;
}

export class UpdateProductUseCase {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(input: IUpdateProductInput): Promise<{ product: ProductObject }> {
    const product = await this.productRepository.findByIdAndStoreId(
      input.productId,
      input.storeId,
      input.environment,
    );
    if (!product) throw new ProductNotFoundError(input.productId);

    if (input.externalId && input.externalId !== product.externalId) {
      const exists = await this.productRepository.externalIdExists(
        input.externalId,
        input.storeId,
        input.environment,
        product.id,
      );
      if (exists) throw new ProductExternalIdAlreadyExistsError(input.externalId);
    }

    product.update({
      externalId: input.externalId,
      name: input.name,
      description: input.description,
      price: input.price,
      imageUrl: input.imageUrl,
      metadata: input.metadata,
      isActive: input.isActive,
    });

    await this.productRepository.update(product);
    return { product: product.toObject() };
  }
}
