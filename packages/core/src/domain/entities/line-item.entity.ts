export interface LineItemObject {
  id?: string;
  productId?: string;
  productExternalId?: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductLineItemInput {
  productId: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
}

export type CreateLineItemInput = ProductLineItemInput;

export function isProductLineItemInput(input: unknown): input is ProductLineItemInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    'productId' in input &&
    typeof (input as { productId?: unknown }).productId === 'string' &&
    (input as { productId: string }).productId.trim().length > 0
  );
}

export function calculateLineItemTotal(input: { quantity: number; unitPrice: number }): number {
  return input.quantity * input.unitPrice;
}

export function sanitizeLineItem(input: LineItemObject): LineItemObject {
  return {
    id: input.id,
    productId: input.productId,
    productExternalId: input.productExternalId,
    name: input.name,
    description: input.description,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    totalPrice: input.totalPrice,
    imageUrl: input.imageUrl,
    metadata: input.metadata,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}
