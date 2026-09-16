import { Component, computed, inject, signal } from '@angular/core';

import { listQuery } from '../../data/list-query';
import {
  PRODUCT_QUERY,
  type ProductRow,
  productCommands,
  productsResource,
} from '../../data/products';
import { MerchantSession } from '../../data/session';
import { toApiFailure } from '../../domain/api-error';
import {
  EMPTY_DRAFT,
  type ProductDraft,
  draftPrice,
  productBlocker,
  productPayload,
} from '../../domain/product-form';
import {
  MerButton,
  MerChip,
  MerField,
  MerNotice,
  MerPageHeader,
  MerPageState,
  MerPagination,
  MerPanel,
  MerSheet,
  MerTable,
  MerToastService,
} from '../../ui';

const SITUATIONS = [
  { value: 'active', label: 'Ativos' },
  { value: 'inactive', label: 'Arquivados' },
  { value: '', label: 'Todos' },
];

/**
 * Produtos: o catálogo que a API reutiliza nas cobranças.
 *
 * Duas coisas mudam de nome em relação à tela antiga, e as duas são o produto
 * ficando mais honesto:
 *
 * - **não existe excluir.** A API só tem `PATCH`, e é a decisão certa: apagar
 *   um produto deixaria órfã toda cobrança que aponta para ele. A tela fala em
 *   arquivar e reativar, que é o que de fato acontece.
 * - **o formulário é por sinal**, e não `ReactiveForms`. A tela antiga era a
 *   única do dashboard com formulário reativo, e a validação dele só se provava
 *   abrindo o navegador. Aqui ela mora em `domain/product-form`, com teste.
 */
@Component({
  selector: 'app-console-products',
  standalone: true,
  imports: [
    MerButton,
    MerChip,
    MerField,
    MerNotice,
    MerPageHeader,
    MerPageState,
    MerPagination,
    MerPanel,
    MerSheet,
    MerTable,
  ],
  templateUrl: './products.html',
  styleUrl: './products.css',
})
export class ConsoleProducts {
  private readonly commands = productCommands();
  private readonly toast = inject(MerToastService);

  protected readonly session = inject(MerchantSession);
  protected readonly query = listQuery(PRODUCT_QUERY);
  protected readonly params = this.query.params;
  protected readonly situations = SITUATIONS;

  protected readonly products = productsResource(this.params);
  protected readonly page = computed(() => this.products.value());

  protected readonly failure = computed(() => {
    const error = this.products.error();
    return error ? toApiFailure(error) : null;
  });

  protected readonly isEmpty = computed(
    () => !this.products.isLoading() && this.page().products.length === 0,
  );

  /* ── A folha do produto ─────────────────────────────────────────────── */
  protected readonly sheetOpen = signal(false);
  protected readonly editing = signal<ProductRow | null>(null);
  protected readonly draft = signal<ProductDraft>(EMPTY_DRAFT);
  protected readonly saving = signal(false);
  protected readonly formError = signal('');

  protected readonly blocker = computed(() => productBlocker(this.draft()));
  protected readonly preview = computed(() => draftPrice(this.draft()));

  /* ── Arquivar ───────────────────────────────────────────────────────── */
  protected readonly archiving = signal<ProductRow | null>(null);
  protected readonly busy = signal('');

  protected openNew(): void {
    this.editing.set(null);
    this.draft.set(EMPTY_DRAFT);
    this.formError.set('');
    this.sheetOpen.set(true);
  }

  protected openEdit(product: ProductRow): void {
    this.editing.set(product);
    this.draft.set({
      name: product.name,
      price: (product.price / 100).toFixed(2).replace('.', ','),
      externalId: product.externalId ?? '',
      description: product.description ?? '',
      imageUrl: product.imageUrl ?? '',
      metadata: product.metadata ? JSON.stringify(product.metadata, null, 2) : '',
    });
    this.formError.set('');
    this.sheetOpen.set(true);
  }

  protected closeSheet(): void {
    if (this.saving()) return;
    this.sheetOpen.set(false);
  }

  protected edit<K extends keyof ProductDraft>(field: K, value: string): void {
    this.draft.update((current) => ({ ...current, [field]: value }));
    this.formError.set('');
  }

  protected async save(): Promise<void> {
    const blocker = this.blocker();
    if (blocker) {
      this.formError.set(blocker);
      return;
    }

    const payload = productPayload(this.draft());
    const product = this.editing();

    this.saving.set(true);
    const result = product
      ? await this.commands.update(product.id, payload)
      : await this.commands.create(payload);
    this.saving.set(false);

    if (!result.ok) {
      this.formError.set(result.failure.message);
      return;
    }

    this.sheetOpen.set(false);
    this.toast.ok(product ? 'Produto atualizado.' : 'Produto criado.');
    this.products.reload();
  }

  protected async confirmArchive(): Promise<void> {
    const product = this.archiving();
    if (!product || this.busy()) return;

    this.busy.set(product.id);
    const result = await this.commands.archive(product.id);
    this.busy.set('');

    if (!result.ok) {
      this.toast.bad('Não foi possível arquivar o produto.', result.failure.message);
      return;
    }

    this.archiving.set(null);
    this.toast.ok(
      `"${product.name}" foi arquivado.`,
      'Ele some do catálogo ativo, e as cobranças antigas continuam válidas.',
    );
    this.products.reload();
  }

  protected async reactivate(product: ProductRow): Promise<void> {
    if (this.busy()) return;

    this.busy.set(product.id);
    const result = await this.commands.reactivate(product.id);
    this.busy.set('');

    if (!result.ok) {
      this.toast.bad('Não foi possível reativar o produto.', result.failure.message);
      return;
    }

    this.toast.ok(`"${product.name}" voltou ao catálogo.`);
    this.products.reload();
  }

  /* ── Lista ──────────────────────────────────────────────────────────── */
  protected search(value: string): void {
    this.query.set({ q: value.trim() });
  }

  protected setSituation(value: string): void {
    this.query.set({ situation: value });
  }

  protected clear(): void {
    this.query.clear();
  }

  protected goTo(page: number): void {
    this.query.page(page);
  }

  protected money(cents: number): string {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  protected when(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }
}
