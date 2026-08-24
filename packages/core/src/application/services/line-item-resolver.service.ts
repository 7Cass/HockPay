import {
  calculateLineItemTotal,
  CreateLineItemInput,
  isProductLineItemInput,
  LineItemObject,
} from '../../domain/entities/line-item.entity';
import { InvalidLineItemsError } from '../../domain/errors/invalid-line-items.error';
import { ProductNotFoundError } from '../../domain/errors/product-not-found.error';
import { ProductUnavailableError } from '../../domain/errors/product-unavailable.error';
import { IProductRepository } from '../../domain/repositories/product.repository.interface';
import { Environment } from '../../domain/value-objects/environment.vo';

export interface ResolveChargeLineItemsInput {
  storeId: string;
  environment: Environment;
  amount?: number;
  items?: CreateLineItemInput[];
}

export interface ResolveChargeLineItemsOutput {
  amount: number;
  items: LineItemObject[];
}

export class LineItemResolverService {
  constructor(private readonly productRepository: IProductRepository) {}

  async resolve(input: ResolveChargeLineItemsInput): Promise<ResolveChargeLineItemsOutput> {
    const hasAmount = input.amount !== undefined;
    const hasItems = Array.isArray(input.items) && input.items.length > 0;

    if (hasAmount === hasItems) {
      throw new InvalidLineItemsError('Provide exactly one of amount or items');
    }

    if (hasAmount) {
      return { amount: validateAmount(input.amount), items: [] };
    }

    const items = await Promise.all(
      (input.items ?? []).map((item) => this.resolveItem(input.storeId, input.environment, item)),
    );

    const amount = items.reduce((sum, item) => sum + item.totalPrice, 0);
    return { amount: validateAmount(amount), items };
  }

  private async resolveItem(
    storeId: string,
    environment: Environment,
    input: CreateLineItemInput,
  ): Promise<LineItemObject> {
    if (!isProductLineItemInput(input)) {
      throw new InvalidLineItemsError('Line item productId is required');
    }

    const quantity = validateQuantity(input.quantity ?? 1);

    const product = await this.productRepository.findByIdAndStoreId(
      input.productId,
      storeId,
      environment,
    );
    if (!product) throw new ProductNotFoundError(input.productId);
    if (!product.isActive) throw new ProductUnavailableError(input.productId);

    return {
      productId: product.id,
      productExternalId: product.externalId,
      name: product.name,
      description: product.description,
      quantity,
      unitPrice: product.price,
      totalPrice: calculateLineItemTotal({
        quantity,
        unitPrice: product.price,
      }),
      imageUrl: product.imageUrl,
      metadata: input.metadata,
    };
  }
}

function validateAmount(value: number | undefined): number {
  if (value === undefined || !Number.isInteger(value) || value < 1) {
    throw new InvalidLineItemsError('Amount must be at least 1 cent');
  }
  if (value > 9999999999) {
    throw new InvalidLineItemsError('Amount cannot exceed 99,999,999.99 BRL');
  }
  return value;
}

function validateQuantity(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new InvalidLineItemsError('Line item quantity must be at least 1');
  }
  return value;
}
