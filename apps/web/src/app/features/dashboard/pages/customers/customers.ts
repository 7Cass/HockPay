import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideRefreshCcw,
  lucideSearch,
  lucideUserRound,
  lucideUsers,
  lucideXCircle,
} from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { CustomerObject, CustomerService } from '../../../../core/services/customer.service';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [
    DatePipe,
    HlmButtonImports,
    HlmIconImports,
    HlmInputImports,
    HlmSpinnerImports,
    HlmTableImports,
  ],
  providers: [
    provideIcons({
      lucideArrowRight,
      lucideRefreshCcw,
      lucideSearch,
      lucideUserRound,
      lucideUsers,
      lucideXCircle,
    }),
  ],
  template: `
    <div class="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-zinc-900">Clientes</h1>
          <p class="mt-1 text-sm text-zinc-500">Consulte clientes identificados em pagamentos e checkout.</p>
        </div>

        <button
          hlmBtn
          variant="outline"
          size="sm"
          class="gap-2 self-start border-zinc-200/80 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 hover:text-zinc-900"
          (click)="reload()"
        >
          <ng-icon hlm name="lucideRefreshCcw" size="xs"></ng-icon>
          Atualizar
        </button>
      </div>

      <div class="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div class="flex-1">
            <label for="customer-search" class="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Buscar cliente
            </label>
            <div class="relative">
              <ng-icon hlm name="lucideSearch" class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size="sm"></ng-icon>
              <input
                hlmInput
                id="customer-search"
                type="text"
                [value]="search()"
                (input)="onSearchInput($any($event.target).value)"
                (keydown.enter)="applySearch()"
                class="pl-10"
                placeholder="Nome, email, documento ou externalId"
              />
            </div>
          </div>

          <div class="flex items-center gap-3">
            <button
              hlmBtn
              variant="outline"
              size="sm"
              class="border-zinc-200/80 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 hover:text-zinc-900"
              (click)="clearSearch()"
            >
              Limpar
            </button>
            <button
              hlmBtn
              size="sm"
              class="gap-2 bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
              (click)="applySearch()"
            >
              <ng-icon hlm name="lucideSearch" size="xs"></ng-icon>
              Buscar
            </button>
          </div>
        </div>
      </div>

      @if (customerService.error()) {
        <div class="flex items-start gap-3 rounded-xl border border-red-200/60 bg-red-50 p-4 text-red-700 shadow-sm">
          <ng-icon hlm name="lucideXCircle" class="mt-0.5 text-red-500"></ng-icon>
          <div class="flex-1">
            <h3 class="text-sm font-semibold">Erro ao carregar clientes</h3>
            <p class="mt-1 text-sm opacity-90">{{ customerService.error() }}</p>
          </div>
        </div>
      }

      <div class="flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm">
        @if (customerService.isLoading()) {
          <div class="flex flex-1 flex-col items-center justify-center py-24">
            <hlm-spinner class="h-6 w-6 animate-spin text-indigo-600" />
            <p class="mt-4 text-sm font-medium text-zinc-500">Buscando clientes...</p>
          </div>
        }

        @if (!customerService.isLoading() && !customerService.error() && customerService.customers().length === 0) {
          <div class="flex flex-1 flex-col items-center justify-center bg-zinc-50/30 px-6 py-24 text-center">
            <div class="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 shadow-sm">
              <ng-icon hlm name="lucideUsers" size="xl" class="text-indigo-600 opacity-80" strokeWidth="1.5"></ng-icon>
            </div>
            <h3 class="mb-1.5 text-base font-semibold text-zinc-900">Nenhum cliente encontrado</h3>
            <p class="mx-auto max-w-sm text-sm text-zinc-500">
              {{ hasActiveSearch() ? 'Nenhum cliente corresponde à busca informada.' : 'Clientes aparecem aqui quando pagamentos identificados forem criados.' }}
            </p>
          </div>
        }

        @if (!customerService.isLoading() && customerService.customers().length > 0) {
          <div class="flex-1 overflow-x-auto">
            <table hlmTable class="w-full">
              <thead hlmTHead class="border-b border-zinc-200/80 bg-zinc-50/50">
                <tr hlmTr class="border-none hover:bg-transparent">
                  <th hlmTh class="py-3.5 pl-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">Cliente</th>
                  <th hlmTh class="py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">Documento</th>
                  <th hlmTh class="py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">External ID</th>
                  <th hlmTh class="py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">Criado em</th>
                  <th hlmTh class="py-3.5 pr-6 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Ação</th>
                </tr>
              </thead>

              <tbody hlmTBody class="divide-y divide-zinc-100">
                @for (customer of customerService.customers(); track customer.id) {
                  <tr hlmTr class="group border-none transition-colors hover:bg-zinc-50/80">
                    <td hlmTd class="py-3.5 pl-6">
                      <div class="flex items-center gap-3">
                        <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-zinc-200/60 bg-zinc-100 text-zinc-500 transition-all group-hover:border-zinc-300 group-hover:bg-white group-hover:shadow-sm">
                          <ng-icon hlm name="lucideUserRound" size="sm" strokeWidth="1.5"></ng-icon>
                        </div>
                        <div class="flex min-w-0 flex-col">
                          <span class="truncate text-sm font-medium text-zinc-900">{{ displayName(customer) }}</span>
                          <span class="mt-0.5 truncate text-xs text-zinc-400">{{ customer.email || customer.phone || 'Sem contato adicional' }}</span>
                        </div>
                      </div>
                    </td>
                    <td hlmTd class="py-3.5">
                      <div class="flex flex-col">
                        <span class="text-sm font-medium text-zinc-900">{{ customer.formattedDocument }}</span>
                        <span class="mt-0.5 text-xs text-zinc-400">{{ customer.documentType }}</span>
                      </div>
                    </td>
                    <td hlmTd class="py-3.5">
                      <span class="font-mono text-sm text-zinc-600">{{ customer.externalId || 'Sem externalId' }}</span>
                    </td>
                    <td hlmTd class="py-3.5">
                      <div class="flex flex-col">
                        <span class="text-sm font-medium text-zinc-900">{{ customer.createdAt | date:'dd/MM/yyyy' }}</span>
                        <span class="mt-0.5 text-xs text-zinc-400">{{ customer.createdAt | date:'HH:mm' }}</span>
                      </div>
                    </td>
                    <td hlmTd class="py-3.5 pr-6 text-right">
                      <button
                        hlmBtn
                        variant="ghost"
                        size="sm"
                        class="gap-2 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                        (click)="openCustomer(customer.id)"
                      >
                        Ver cliente
                        <ng-icon hlm name="lucideArrowRight" size="xs"></ng-icon>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="flex flex-col gap-3 border-t border-zinc-200/80 bg-zinc-50/50 px-6 py-4 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <span class="flex items-center gap-1.5">
              Exibindo
              <span class="rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-semibold text-zinc-700 shadow-sm">
                {{ customerService.customers().length }}
              </span>
              de
              <span class="font-semibold text-zinc-900">{{ customerService.total() }}</span>
              clientes
            </span>

            <div class="flex items-center gap-3 self-end sm:self-auto">
              <button
                hlmBtn
                variant="outline"
                size="sm"
                class="border-zinc-200/80 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 hover:text-zinc-900"
                [disabled]="customerService.page() <= 1"
                (click)="changePage(-1)"
              >
                Anterior
              </button>
              <span>Página <span class="font-semibold text-zinc-900">{{ customerService.page() }}</span> de <span class="font-semibold text-zinc-900">{{ customerService.totalPages() || 1 }}</span></span>
              <button
                hlmBtn
                variant="outline"
                size="sm"
                class="border-zinc-200/80 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 hover:text-zinc-900"
                [disabled]="customerService.page() >= customerService.totalPages()"
                (click)="changePage(1)"
              >
                Próxima
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class Customers implements OnInit {
  readonly customerService = inject(CustomerService);
  private readonly router = inject(Router);

  readonly search = signal('');
  private readonly pageSize = 20;

  ngOnInit(): void {
    this.loadCustomers();
  }

  onSearchInput(value: string): void {
    this.search.set(value);
  }

  applySearch(): void {
    this.loadCustomers(1);
  }

  clearSearch(): void {
    this.search.set('');
    this.loadCustomers(1);
  }

  reload(): void {
    this.loadCustomers(this.customerService.page());
  }

  changePage(direction: number): void {
    this.loadCustomers(this.customerService.page() + direction);
  }

  openCustomer(customerId: string): void {
    void this.router.navigate(['/dashboard/customers', customerId]);
  }

  hasActiveSearch(): boolean {
    return this.search().trim().length > 0;
  }

  displayName(customer: CustomerObject): string {
    return customer.name || customer.email || customer.externalId || customer.formattedDocument;
  }

  private loadCustomers(page = 1): void {
    this.customerService.loadCustomers({
      page,
      limit: this.pageSize,
      search: this.search().trim() || undefined,
    });
  }
}
