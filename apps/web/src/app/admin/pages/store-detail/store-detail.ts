import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoader2, lucideRefreshCcw } from '@ng-icons/lucide';
import { Subscription } from 'rxjs';
import { toast } from 'ngx-sonner';

import {
  COMMERCIAL_TERMS_RANGE,
  OperatorStoreService,
} from '../../services/operator-store.service';
import { AdmPageHeader, AdmPageState } from '../../ui';
import { OperatorInvestigation } from './investigation/investigation';
import { LIVE_STATUS_LABEL, LIVE_STATUS_TONE } from '../../domain/live-status';

interface TermsDraft {
  feePercent: string;
  feeFixed: string;
  settlementDays: string;
}

/**
 * A loja aberta pela mesa.
 *
 * Abrir esta tela grava `store.investigated` na trilha — o GET do detalhe é o
 * ponto de entrada de qualquer investigação, e é ele que escreve. Vale para
 * quem veio ajustar a taxa também: a linha diz que a loja foi aberta, e a
 * mudança de condição comercial deixa a sua própria linha depois.
 */
@Component({
  selector: 'app-operator-store-detail',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    NgIcon,
    AdmPageHeader,
    AdmPageState,
    OperatorInvestigation,
  ],
  providers: [provideIcons({ lucideLoader2, lucideRefreshCcw })],
  templateUrl: './store-detail.html',
  styleUrl: './store-detail.css',
})
export class OperatorStoreDetail implements OnInit, OnDestroy {
  protected readonly desk = inject(OperatorStoreService);
  private readonly route = inject(ActivatedRoute);
  private routeSub?: Subscription;

  protected readonly statusLabel = LIVE_STATUS_LABEL;
  protected readonly statusTone = LIVE_STATUS_TONE;
  protected readonly range = COMMERCIAL_TERMS_RANGE;

  protected readonly storeId = signal('');
  protected readonly reason = signal('');
  protected readonly isSaving = signal(false);

  /** O formulário é texto: um campo vazio não vale zero. */
  protected readonly draft = signal<TermsDraft>({
    feePercent: '',
    feeFixed: '',
    settlementDays: '',
  });

  constructor() {
    // A loja chega depois da tela; o rascunho começa na condição de hoje.
    effect(() => {
      const store = this.desk.store();
      if (!store) return;

      this.draft.set({
        feePercent: String(store.feePercent),
        feeFixed: String(store.feeFixed),
        settlementDays: String(store.settlementDays),
      });
    });
  }

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe((params) => {
      const id = params.get('id') ?? '';
      this.storeId.set(id);
      this.reason.set('');
      if (id) this.desk.loadStore(id);
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  protected reload(): void {
    if (this.storeId()) this.desk.loadStore(this.storeId());
  }

  protected setField(field: keyof TermsDraft, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.draft.update((draft) => ({ ...draft, [field]: value }));
  }

  protected setReason(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  /** Os três valores do rascunho, ou `null` enquanto algum não for um número. */
  protected readonly parsed = computed(() => {
    const draft = this.draft();
    const feePercent = toNumber(draft.feePercent);
    const feeFixed = toNumber(draft.feeFixed);
    const settlementDays = toNumber(draft.settlementDays);

    if (feePercent === null || feeFixed === null || settlementDays === null) return null;

    return { feePercent, feeFixed, settlementDays };
  });

  protected readonly outOfRange = computed(() => {
    const terms = this.parsed();
    if (!terms) return [] as Array<keyof TermsDraft>;

    const bad: Array<keyof TermsDraft> = [];
    if (!inRange(terms.feePercent, this.range.feePercent)) bad.push('feePercent');
    if (!inRange(terms.feeFixed, this.range.feeFixed) || !Number.isInteger(terms.feeFixed)) {
      bad.push('feeFixed');
    }
    if (
      !inRange(terms.settlementDays, this.range.settlementDays) ||
      !Number.isInteger(terms.settlementDays)
    ) {
      bad.push('settlementDays');
    }
    return bad;
  });

  protected readonly changed = computed(() => {
    const store = this.desk.store();
    const terms = this.parsed();
    if (!store || !terms) return false;

    return (
      terms.feePercent !== store.feePercent ||
      terms.feeFixed !== store.feeFixed ||
      terms.settlementDays !== store.settlementDays
    );
  });

  /** Encurtar o prazo antecipa a liberação do que já está pendente (D3). */
  protected readonly shortensSettlement = computed(() => {
    const store = this.desk.store();
    const terms = this.parsed();
    return !!store && !!terms && terms.settlementDays < store.settlementDays;
  });

  protected readonly canSave = computed(
    () =>
      !!this.parsed() &&
      this.outOfRange().length === 0 &&
      this.changed() &&
      this.reason().trim().length > 0 &&
      !this.isSaving(),
  );

  protected fieldChanged(field: keyof TermsDraft): boolean {
    const store = this.desk.store();
    const terms = this.parsed();
    if (!store || !terms) return false;
    return terms[field] !== store[field];
  }

  protected discard(): void {
    const store = this.desk.store();
    if (!store) return;

    this.draft.set({
      feePercent: String(store.feePercent),
      feeFixed: String(store.feeFixed),
      settlementDays: String(store.settlementDays),
    });
    this.reason.set('');
  }

  protected save(): void {
    const terms = this.parsed();
    if (!terms || !this.canSave()) return;

    this.isSaving.set(true);

    this.desk
      .updateCommercialTerms(this.storeId(), { ...terms, reason: this.reason().trim() })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.reason.set('');
          toast.success('Condição comercial registrada, com linha na trilha.');
        },
        error: (err: HttpErrorResponse) => {
          this.isSaving.set(false);
          toast.error(err.error?.error?.message || 'Não foi possível mudar a condição.');
        },
      });
  }
}

function toNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function inRange(value: number, range: { min: number; max: number }): boolean {
  return value >= range.min && value <= range.max;
}
