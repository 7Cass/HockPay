import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import {
  LINK_QUERY,
  type PaymentLink,
  type Product,
  chargeCommands,
  linksResource,
  productSearchResource,
} from '../../data/charges';
import { listQuery } from '../../data/list-query';
import { parseReaisToCents } from '../../domain/api-contracts';
import { toApiFailure } from '../../domain/api-error';
import { isLinkTerminal, linkTone } from '../../domain/charge-outcomes';
import { conversionPercent } from '../../domain/conversion';
import {
  MerButton,
  MerChip,
  MerCopy,
  MerField,
  MerNotice,
  MerPageHeader,
  MerPageState,
  MerPagination,
  MerPanel,
  MerSheet,
  MerStat,
  MerTable,
} from '../../ui';

const FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'ACTIVE', label: 'Ativos' },
  { value: 'OPENED', label: 'Abertos' },
  { value: 'PAID', label: 'Pagos' },
  { value: 'failures', label: 'Com falha' },
  { value: 'EXPIRED', label: 'Expirados' },
  { value: 'CANCELLED', label: 'Cancelados' },
];

interface Chosen {
  readonly product: Product;
  readonly quantity: number;
}

/**
 * Links de pagamento: cobranças que se mandam por mensagem.
 *
 * O link cobra **valor avulso ou itens do catálogo, nunca os dois** — é regra
 * da API, e a tela a espelha com dois modos exclusivos em vez de deixar o
 * lojista preencher os dois e descobrir no erro.
 */
@Component({
  selector: 'app-console-payment-links',
  standalone: true,
  imports: [
    DatePipe,
    MerButton,
    MerChip,
    MerCopy,
    MerField,
    MerNotice,
    MerPageHeader,
    MerPageState,
    MerPagination,
    MerPanel,
    MerSheet,
    MerStat,
    MerTable,
  ],
  templateUrl: './payment-links.html',
  styleUrl: './payment-links.css',
})
export class ConsolePaymentLinks {
  private readonly router = inject(Router);
  private readonly commands = chargeCommands();

  protected readonly query = listQuery(LINK_QUERY);
  protected readonly params = this.query.params;
  protected readonly filters = FILTERS;

  protected readonly links = linksResource(this.params);
  protected readonly page = computed(() => this.links.value());
  protected readonly stats = computed(() => this.page().stats);

  protected readonly failure = computed(() =>
    this.links.error() ? toApiFailure(this.links.error()) : null,
  );

  protected readonly isEmpty = computed(
    () => !this.links.isLoading() && this.page().items.length === 0,
  );

  /* ── Criação ────────────────────────────────────────────────────────── */
  protected readonly sheetOpen = signal(false);
  protected readonly mode = signal<'amount' | 'items'>('amount');
  protected readonly amountText = signal('');
  protected readonly title = signal('');
  protected readonly reference = signal('');
  protected readonly expiresAt = signal('');
  protected readonly creating = signal(false);
  protected readonly createError = signal('');

  protected readonly term = signal('');
  protected readonly catalog = productSearchResource(this.term);
  protected readonly chosen = signal<readonly Chosen[]>([]);

  protected readonly amount = computed(() => parseReaisToCents(this.amountText()) ?? 0);
  protected readonly itemsTotal = computed(() =>
    this.chosen().reduce((sum, entry) => sum + entry.product.price * entry.quantity, 0),
  );
  protected readonly total = computed(() =>
    this.mode() === 'items' ? this.itemsTotal() : this.amount(),
  );

  protected readonly createBlocker = computed(() => {
    if (this.mode() === 'items') {
      return this.chosen().length === 0 ? 'Escolha ao menos um produto.' : null;
    }
    return this.amount() < 1 ? 'Informe um valor maior que zero.' : null;
  });

  protected openSheet(): void {
    this.createError.set('');
    this.amountText.set('');
    this.title.set('');
    this.reference.set('');
    this.expiresAt.set('');
    this.chosen.set([]);
    this.mode.set('amount');
    this.sheetOpen.set(true);
  }

  protected closeSheet(): void {
    if (this.creating()) return;
    this.sheetOpen.set(false);
  }

  protected setMode(mode: 'amount' | 'items'): void {
    this.mode.set(mode);
    this.createError.set('');
    if (mode === 'amount') this.chosen.set([]);
    else this.amountText.set('');
  }

  /** Somar quantidade em vez de repetir a linha do mesmo produto. */
  protected add(product: Product): void {
    this.chosen.update((current) => {
      const existing = current.find((entry) => entry.product.id === product.id);
      if (existing) {
        return current.map((entry) =>
          entry.product.id === product.id ? { ...entry, quantity: entry.quantity + 1 } : entry,
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  }

  protected remove(productId: string): void {
    this.chosen.update((current) => current.filter((entry) => entry.product.id !== productId));
  }

  protected async create(): Promise<void> {
    const blocker = this.createBlocker();
    if (blocker || this.creating()) {
      this.createError.set(blocker ?? '');
      return;
    }

    const isItems = this.mode() === 'items';
    const input = {
      ...(isItems
        ? {
            items: this.chosen().map((entry) => ({
              productId: entry.product.id,
              quantity: entry.quantity,
            })),
          }
        : { amount: this.amount() }),
      ...(this.title().trim() ? { title: this.title().trim() } : {}),
      ...(this.reference().trim() ? { internalReference: this.reference().trim() } : {}),
      ...(this.expiresAt() ? { expiresAt: new Date(this.expiresAt()).toISOString() } : {}),
    };

    // A impressão digital do pedido: mesmo link pedido de novo repete a chave.
    const intent = isItems
      ? `items:${this.chosen()
          .map((entry) => `${entry.product.id}x${entry.quantity}`)
          .join(',')}:${this.title().trim()}`
      : `amount:${this.amount()}:${this.title().trim()}`;

    this.creating.set(true);
    const result = await this.commands.createLink(input, intent);
    this.creating.set(false);

    if (!result.ok) {
      this.createError.set(result.failure.message);
      return;
    }

    this.commands.forgetLink(intent);
    this.sheetOpen.set(false);
    void this.router.navigate(['/dashboard/payment-links', result.value.paymentLink.id]);
  }

  /* ── Lista ──────────────────────────────────────────────────────────── */
  protected setFilter(value: string): void {
    this.query.set({ status: value });
  }

  protected goTo(page: number): void {
    this.query.page(page);
  }

  protected reload(): void {
    this.links.reload();
  }

  protected open(id: string): void {
    void this.router.navigate(['/dashboard/payment-links', id]);
  }

  protected tone(status: string) {
    return linkTone(status);
  }

  protected isDead(link: PaymentLink): boolean {
    return isLinkTerminal(link.status);
  }

  protected linkTitle(link: PaymentLink): string {
    return link.title || link.description || 'Link avulso';
  }

  protected money(cents?: number | null): string {
    return ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /** A API manda fração; quem traduz é o domínio, com teste. */
  protected percent(value: number): string {
    return conversionPercent(value);
  }
}
