import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import {
    lucideBadgeDollarSign,
    lucideBuilding2,
    lucideCalendarClock,
    lucideCheckCircle2,
    lucideCircleDollarSign,
    lucideClock,
    lucideFileText,
    lucideInfo,
    lucideRefreshCcw,
    lucideShieldCheck,
    lucideStore,
    lucideUser,
    lucideX,
    lucideXCircle,
} from '@ng-icons/lucide';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { AuthService } from '../../../../core/services/auth.service';
import { Store, StoreService } from '../../../../core/services/store.service';

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [
        CommonModule,
        DatePipe,
        CurrencyPipe,
        HlmBadgeImports,
        HlmButtonImports,
        HlmIconImports,
        HlmSpinnerImports,
    ],
    providers: [
        provideIcons({
            lucideBadgeDollarSign,
            lucideBuilding2,
            lucideCalendarClock,
            lucideCheckCircle2,
            lucideCircleDollarSign,
            lucideClock,
            lucideFileText,
            lucideInfo,
            lucideRefreshCcw,
            lucideShieldCheck,
            lucideStore,
            lucideUser,
            lucideX,
            lucideXCircle,
        }),
    ],
    template: `
    <div class="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-2xl font-bold tracking-tight text-zinc-900">Configurações</h1>
            @if (currentStore(); as store) {
              <span hlmBadge variant="secondary" class="border border-zinc-200 bg-white text-zinc-700">
                {{ store.name }}
              </span>
            }
          </div>
          <p class="mt-1 max-w-2xl text-sm text-zinc-500">
            Dados da conta, loja atual e condições comerciais definidas pela HockPay.
          </p>
        </div>

        <button hlmBtn variant="outline" type="button" (click)="reload()" [disabled]="isLoading()"
          class="w-fit border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50">
          <ng-icon hlm name="lucideRefreshCcw" size="sm" class="mr-2" [class.animate-spin]="isLoading()"></ng-icon>
          Atualizar
        </button>
      </div>

      @if (isLoading()) {
        <div class="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-zinc-200/80 bg-white py-24 shadow-sm">
          <hlm-spinner class="h-6 w-6 animate-spin text-indigo-600" />
          <p class="mt-4 text-sm font-medium text-zinc-500">Carregando configurações...</p>
        </div>
      } @else if (error()) {
        <div class="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-red-200/80 bg-red-50 px-6 py-24 text-center shadow-sm">
          <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
            <ng-icon hlm name="lucideXCircle" class="text-red-500" size="lg"></ng-icon>
          </div>
          <h2 class="text-base font-semibold text-red-700">Não foi possível carregar as configurações</h2>
          <p class="mt-2 max-w-md text-sm text-red-700/90">{{ error() }}</p>
          <button hlmBtn type="button" class="mt-6 bg-white text-red-700 shadow-sm hover:bg-red-100" (click)="reload()">
            Tentar novamente
          </button>
        </div>
      } @else {
        <div class="grid gap-4 lg:grid-cols-3">
          <section class="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm lg:col-span-2">
            <div class="flex items-start justify-between gap-4 border-b border-zinc-100 pb-5">
              <div>
                <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <ng-icon hlm name="lucideUser" size="xs"></ng-icon>
                  Conta
                </div>
                <h2 class="mt-2 text-base font-semibold text-zinc-900">{{ currentUser()?.name || 'Conta HockPay' }}</h2>
              </div>
              <span hlmBadge variant="secondary" [class]="accountStatusClasses()">
                {{ currentUser()?.isActive ? 'Ativa' : 'Inativa' }}
              </span>
            </div>

            <dl class="mt-5 grid gap-3 sm:grid-cols-2">
              <div class="rounded-lg border border-zinc-200/80 bg-zinc-50/50 px-3 py-2">
                <dt class="text-xs font-medium text-zinc-500">E-mail</dt>
                <dd class="mt-1 break-words text-sm font-semibold text-zinc-900">{{ currentUser()?.email || '-' }}</dd>
              </div>
              <div class="rounded-lg border border-zinc-200/80 bg-zinc-50/50 px-3 py-2">
                <dt class="text-xs font-medium text-zinc-500">Documento</dt>
                <dd class="mt-1 text-sm font-semibold text-zinc-900">{{ currentUser()?.formattedDocument || currentUser()?.document || '-' }}</dd>
              </div>
              <div class="rounded-lg border border-zinc-200/80 bg-zinc-50/50 px-3 py-2">
                <dt class="text-xs font-medium text-zinc-500">Tipo</dt>
                <dd class="mt-1 text-sm font-semibold text-zinc-900">{{ currentUser()?.documentType || '-' }}</dd>
              </div>
              <div class="rounded-lg border border-zinc-200/80 bg-zinc-50/50 px-3 py-2">
                <dt class="text-xs font-medium text-zinc-500">Criada em</dt>
                <dd class="mt-1 text-sm font-semibold text-zinc-900">{{ currentUser()?.createdAt | date:'dd/MM/yyyy' }}</dd>
              </div>
            </dl>
          </section>

          <section class="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm">
            <div class="flex items-start justify-between gap-4">
              <div>
                <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <ng-icon hlm name="lucideStore" size="xs"></ng-icon>
                  Contexto
                </div>
                <h2 class="mt-2 text-base font-semibold text-zinc-900">Loja selecionada</h2>
              </div>
              <span class="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                {{ storesCount() }} {{ storesCount() === 1 ? 'loja' : 'lojas' }}
              </span>
            </div>

            @if (currentStore(); as store) {
              <p class="mt-4 text-sm text-zinc-600">
                Esta página acompanha a loja ativa no seletor da sidebar.
              </p>
              <div class="mt-5 rounded-lg border border-zinc-200/80 bg-zinc-50/50 px-3 py-2">
                <p class="text-xs font-medium text-zinc-500">Store ID</p>
                <p class="mt-1 break-all font-mono text-xs font-semibold text-zinc-900">{{ store.id }}</p>
              </div>
            } @else {
              <p class="mt-4 text-sm text-zinc-600">Nenhuma loja selecionada para configurar.</p>
            }
          </section>
        </div>

        @if (currentStore(); as store) {
          <div class="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <section class="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm">
              <div class="flex flex-col gap-4 border-b border-zinc-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <ng-icon hlm name="lucideBuilding2" size="xs"></ng-icon>
                    Loja atual
                  </div>
                  <h2 class="mt-2 text-base font-semibold text-zinc-900">{{ store.name }}</h2>
                  <p class="mt-1 font-mono text-sm text-zinc-500">{{ store.slug }}</p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <span hlmBadge variant="secondary" [class]="storeActiveClasses(store)">
                    {{ store.isActive ? 'Ativa' : 'Inativa' }}
                  </span>
                  <span hlmBadge variant="secondary" [class]="storeApprovedClasses(store)">
                    {{ store.isApproved ? 'Aprovada' : 'Pendente' }}
                  </span>
                </div>
              </div>

              <dl class="mt-5 grid gap-3 sm:grid-cols-2">
                <div class="rounded-lg border border-zinc-200/80 bg-zinc-50/50 px-3 py-2">
                  <dt class="text-xs font-medium text-zinc-500">Nome público</dt>
                  <dd class="mt-1 text-sm font-semibold text-zinc-900">{{ store.name }}</dd>
                </div>
                <div class="rounded-lg border border-zinc-200/80 bg-zinc-50/50 px-3 py-2">
                  <dt class="text-xs font-medium text-zinc-500">Slug</dt>
                  <dd class="mt-1 font-mono text-sm font-semibold text-zinc-900">{{ store.slug }}</dd>
                </div>
                <div class="rounded-lg border border-zinc-200/80 bg-zinc-50/50 px-3 py-2">
                  <dt class="text-xs font-medium text-zinc-500">Criada em</dt>
                  <dd class="mt-1 text-sm font-semibold text-zinc-900">{{ store.createdAt | date:'dd/MM/yyyy HH:mm' }}</dd>
                </div>
                <div class="rounded-lg border border-zinc-200/80 bg-zinc-50/50 px-3 py-2">
                  <dt class="text-xs font-medium text-zinc-500">Atualizada em</dt>
                  <dd class="mt-1 text-sm font-semibold text-zinc-900">{{ store.updatedAt | date:'dd/MM/yyyy HH:mm' }}</dd>
                </div>
              </dl>

              <div class="mt-5 flex items-start gap-3 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                <ng-icon hlm name="lucideInfo" size="sm" class="mt-0.5 flex-shrink-0 text-amber-600"></ng-icon>
                <p>
                  Dados cadastrais da loja são protegidos no HockPay. Alterações serão tratadas por revisão operacional.
                </p>
              </div>
            </section>

            <section class="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm">
              <div class="flex items-start justify-between gap-4 border-b border-zinc-100 pb-5">
                <div>
                  <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <ng-icon hlm name="lucideShieldCheck" size="xs"></ng-icon>
                    Condições comerciais
                  </div>
                  <h2 class="mt-2 text-base font-semibold text-zinc-900">Termos atuais</h2>
                </div>
                <ng-icon hlm name="lucideFileText" class="text-zinc-400" size="sm"></ng-icon>
              </div>

              <div class="mt-5 grid gap-3">
                <div class="rounded-lg border border-zinc-200/80 bg-zinc-50/50 px-3 py-3">
                  <div class="flex items-center justify-between gap-3">
                    <dt class="text-xs font-medium text-zinc-500">Taxa Pix</dt>
                    <ng-icon hlm name="lucideBadgeDollarSign" class="text-zinc-400" size="xs"></ng-icon>
                  </div>
                  <dd class="mt-2 text-lg font-semibold text-zinc-900">
                    {{ formatPercent(store.feePercent) }}% + {{ store.feeFixed / 100 | currency:'BRL':'symbol':'1.2-2' }}
                  </dd>
                </div>

                <div class="rounded-lg border border-zinc-200/80 bg-zinc-50/50 px-3 py-3">
                  <div class="flex items-center justify-between gap-3">
                    <dt class="text-xs font-medium text-zinc-500">Liquidação</dt>
                    <ng-icon hlm name="lucideCalendarClock" class="text-zinc-400" size="xs"></ng-icon>
                  </div>
                  <dd class="mt-2 text-lg font-semibold text-zinc-900">D+{{ store.settlementDays }}</dd>
                </div>
              </div>

              <p class="mt-4 text-sm text-zinc-600">
                Essas condições impactam novos pagamentos e repasses futuros. A edição direta fica restrita ao time HockPay.
              </p>

              <button hlmBtn type="button" variant="outline" class="mt-5 w-full border-dashed border-zinc-300 bg-zinc-50 text-zinc-600 shadow-none hover:bg-zinc-100"
                (click)="openReviewDialog()">
                <ng-icon hlm name="lucideCircleDollarSign" size="sm" class="mr-2"></ng-icon>
                Ver revisão futura
              </button>
            </section>
          </div>
        }
      }

      @if (isReviewDialogOpen()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div class="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h2 class="text-lg font-semibold tracking-tight text-zinc-900">Revisão comercial futura</h2>
                <p class="mt-1 text-sm text-zinc-500">
                  Este é apenas um aviso informativo. Solicitações de revisão comercial não estão disponíveis no P3.
                </p>
              </div>
              <button type="button" (click)="closeReviewDialog()"
                class="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700">
                <ng-icon hlm name="lucideX" size="sm"></ng-icon>
              </button>
            </div>

            <div class="mt-5 rounded-lg border border-zinc-200/80 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
              Em uma entrega futura, a avaliação deve seguir regras padronizadas de risco, volume, histórico e elegibilidade, semelhante a uma revisão de limite em produtos financeiros.
            </div>

            <div class="mt-6 flex justify-end">
              <button hlmBtn type="button" class="bg-zinc-900 text-white hover:bg-zinc-800" (click)="closeReviewDialog()">
                Entendi
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class Settings implements OnInit {
    private readonly authService = inject(AuthService);
    private readonly storeService = inject(StoreService);

    readonly isLoading = signal(true);
    readonly error = signal<string | null>(null);
    readonly isReviewDialogOpen = signal(false);

    readonly currentUser = computed(() => this.authService.currentUser());
    readonly currentStore = computed(() => this.storeService.currentStore());
    readonly storesCount = computed(() => this.storeService.stores().length);

    ngOnInit(): void {
        this.reload();
    }

    reload(): void {
        this.isLoading.set(true);
        this.error.set(null);

        this.storeService.loadStores().subscribe({
            next: () => this.isLoading.set(false),
            error: (err) => {
                console.error('Failed to load settings stores:', err);
                this.error.set(err?.error?.message || err?.message || 'Erro ao carregar lojas.');
                this.isLoading.set(false);
            },
        });
    }

    openReviewDialog(): void {
        this.isReviewDialogOpen.set(true);
    }

    closeReviewDialog(): void {
        this.isReviewDialogOpen.set(false);
    }

    formatPercent(value: number): string {
        return value.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    accountStatusClasses(): string {
        return this.currentUser()?.isActive
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-red-200 bg-red-50 text-red-700';
    }

    storeActiveClasses(store: Store): string {
        return store.isActive
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-red-200 bg-red-50 text-red-700';
    }

    storeApprovedClasses(store: Store): string {
        return store.isApproved
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-amber-200 bg-amber-50 text-amber-700';
    }
}
