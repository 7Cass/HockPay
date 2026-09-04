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

/**
 * Copia um snapshot de line item para uma nova cobranca.
 *
 * O `id` e as datas pertencem ao registro de origem (ex.: `PaymentLinkItem`).
 * Uma tentativa de pagamento cria registros proprios em `PaymentItem`, entao a
 * copia precisa nascer sem identidade -- do contrario duas tabelas diferentes
 * disputam o mesmo id, e um Payment Link com mais de uma tentativa colide na
 * segunda.
 */
export function forkLineItemSnapshot(item: LineItemObject): LineItemObject {
  return {
    productId: item.productId,
    productExternalId: item.productExternalId,
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    imageUrl: item.imageUrl,
    metadata: item.metadata,
  };
}

/**
 * Line item as exposed on public (unauthenticated) surfaces: hosted checkout
 * and the public Payment Link page. Deliberately drops `metadata`, which is
 * merchant-private, and the product ids, which leak catalog structure.
 */
export type PublicLineItem = Pick<
  LineItemObject,
  'id' | 'name' | 'description' | 'quantity' | 'unitPrice' | 'totalPrice' | 'imageUrl'
>;

export function toPublicLineItem(item: LineItemObject): PublicLineItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    imageUrl: item.imageUrl,
  };
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
