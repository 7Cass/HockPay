import { Product, ProductObject } from "../../domain/entities/product.entity";
import { ProductExternalIdAlreadyExistsError } from "../../domain/errors/product-external-id-already-exists.error";
import { IProductRepository } from "../../domain/repositories/product.repository.interface";
import { Environment } from "../../domain/value-objects/environment.vo";

export interface ICreateProductInput {
  storeId: string;
  environment: Environment;
  externalId?: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface ICreateProductOutput {
  product: ProductObject;
}

export class CreateProductUseCase {
  constructor(private readonly productRepository: IProductRepository) {}

  async execute(input: ICreateProductInput): Promise<ICreateProductOutput> {
    if (input.externalId) {
      const exists = await this.productRepository.externalIdExists(
        input.externalId,
        input.storeId,
        input.environment,
      );
      if (exists) throw new ProductExternalIdAlreadyExistsError(input.externalId);
    }

    const product = Product.create({
      storeId: input.storeId,
      environment: input.environment,
      externalId: input.externalId,
      name: input.name,
      description: input.description,
      price: input.price,
      currency: "BRL",
      imageUrl: input.imageUrl,
      metadata: input.metadata,
    });

    await this.productRepository.save(product);
    return { product: product.toObject() };
  }
}
