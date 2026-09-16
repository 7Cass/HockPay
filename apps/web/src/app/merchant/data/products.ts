import { httpResource } from '@angular/common/http';
import { Signal, inject } from '@angular/core';

import type { ListParams } from '../domain/list-params';
import { MerchantApi, type Result } from './api';

export interface ProductRow {
  readonly id: string;
  readonly externalId?: string;
  readonly name: string;
  readonly description?: string;
  readonly price: number;
  readonly currency: string;
  readonly imageUrl?: string;
  readonly metadata?: Record<string, unknown>;
  readonly environment: 'TEST' | 'LIVE';
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProductPage {
  readonly products: readonly ProductRow[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
}

/** O que a tela de produtos escolhe, e o que a URL guarda. */
export interface ProductQuery extends ListParams {
  readonly q: string;
  /** `active`, `inactive` ou vazio para todos. */
  readonly situation: string;
  readonly page: number;
  readonly limit: number;
}

export const PRODUCT_QUERY: ProductQuery = { q: '', situation: 'active', page: 1, limit: 20 };

export const EMPTY_PRODUCTS: ProductPage = {
  products: [],
  total: 0,
  page: 1,
  limit: PRODUCT_QUERY.limit,
  totalPages: 1,
};

/**
 * O que a API recebe.
 *
 * `isActive` é booleano lá e três estados aqui — ativo, arquivado e todos —,
 * porque "todos" precisa **não mandar** o parâmetro. Mandar `isActive=false`
 * para dizer "tanto faz" traria só os arquivados.
 */
export function productsParams(query: ProductQuery): Record<string, string | number | boolean> {
  return {
    page: query.page,
    limit: query.limit,
    ...(query.q.trim() ? { search: query.q.trim() } : {}),
    ...(query.situation === 'active' ? { isActive: true } : {}),
    ...(query.situation === 'inactive' ? { isActive: false } : {}),
  };
}

export function productsResource(query: Signal<ProductQuery>) {
  const api = inject(MerchantApi);

  return httpResource<ProductPage>(() => api.request('/products', productsParams(query())), {
    defaultValue: EMPTY_PRODUCTS,
  });
}

/**
 * As escritas do catálogo.
 *
 * **Não há exclusão.** A API só tem `PATCH`, e arquivar é `isActive: false` —
 * o que é a decisão certa: um produto apagado deixaria órfãs as cobranças que
 * apontam para ele. Por isso a tela fala em "arquivar" e "reativar", e nunca em
 * excluir.
 */
export class ProductCommands {
  constructor(private readonly api: MerchantApi) {}

  create(input: Record<string, unknown>): Promise<Result<{ product: ProductRow }>> {
    return this.api.post('/products', input);
  }

  update(id: string, input: Record<string, unknown>): Promise<Result<{ product: ProductRow }>> {
    return this.api.patch(`/products/${id}`, input);
  }

  archive(id: string): Promise<Result<{ product: ProductRow }>> {
    return this.api.patch(`/products/${id}`, { isActive: false });
  }

  reactivate(id: string): Promise<Result<{ product: ProductRow }>> {
    return this.api.patch(`/products/${id}`, { isActive: true });
  }
}

export function productCommands(): ProductCommands {
  return new ProductCommands(inject(MerchantApi));
}
