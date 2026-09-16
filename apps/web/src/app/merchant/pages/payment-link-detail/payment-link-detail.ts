import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { chargeCommands, linkResource } from '../../data/charges';
import { toApiFailure } from '../../domain/api-error';
import {
  canSimulateLink,
  isLinkTerminal,
  linkSimulationBlocker,
  linkTone,
} from '../../domain/charge-outcomes';
import {
  MerButton,
  MerChip,
  MerCopy,
  MerField,
  MerNotice,
  MerPageHeader,
  MerPageState,
  MerPanel,
  MerSheet,
  MerStat,
  MerTable,
} from '../../ui';

/**
 * O detalhe de um link: uma cobrança Pix e todas as tentativas que passaram
 * por ela.
 *
 * O ponto que a tela precisa ensinar é que **a PixCharge é uma só**. Cada falha
 * cria um pagamento novo, mas a cobrança segue aberta até uma confirmação, a
 * expiração ou o cancelamento — por isso "tentativas" é uma lista, e não um
 * status.
 */
@Component({
  selector: 'app-console-payment-link-detail',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    MerButton,
    MerChip,
    MerCopy,
    MerField,
    MerNotice,
    MerPageHeader,
    MerPageState,
    MerPanel,
    MerSheet,
    MerStat,
    MerTable,
  ],
  templateUrl: './payment-link-detail.html',
  styleUrl: './payment-link-detail.css',
})
export class ConsolePaymentLinkDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly commands = chargeCommands();

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('id') ?? '' },
  );

  protected readonly data = linkResource(this.id);

  protected readonly link = computed(() => this.data.value()?.paymentLink ?? null);
  protected readonly attempts = computed(() => this.link()?.attempts ?? []);

  protected readonly failure = computed(() =>
    this.data.error() ? toApiFailure(this.data.error()) : null,
  );

  protected readonly canSimulate = computed(() => {
    const link = this.link();
    return link ? canSimulateLink(link.status, link.pixCharge.status) : false;
  });

  protected readonly simulationBlocker = computed(() => {
    const link = this.link();
    return link ? linkSimulationBlocker(link.status, link.pixCharge.status) : null;
  });

  protected readonly canCancel = computed(() => {
    const link = this.link();
    return link ? !isLinkTerminal(link.status) : false;
  });

  /* ── Simular pagamento ──────────────────────────────────────────────── */
  protected readonly payOpen = signal(false);
  protected readonly document = signal('');
  protected readonly payerName = signal('');
  protected readonly running = signal(false);
  protected readonly actionError = signal('');

  protected openPay(): void {
    if (!this.canSimulate()) return;
    this.actionError.set('');
    this.document.set('');
    this.payerName.set('');
    this.payOpen.set(true);
  }

  protected closePay(): void {
    if (this.running()) return;
    this.payOpen.set(false);
  }

  protected async pay(): Promise<void> {
    const link = this.link();
    const document = this.document().replace(/\D/g, '');
    if (!link || this.running()) return;

    if (document.length !== 11 && document.length !== 14) {
      this.actionError.set('Informe um CPF ou CNPJ com a quantidade certa de dígitos.');
      return;
    }

    this.running.set(true);
    const result = await this.commands.payLink(link.id, {
      document,
      name: this.payerName().trim() || undefined,
    });
    this.running.set(false);

    if (!result.ok) {
      this.actionError.set(result.failure.message);
      return;
    }

    this.payOpen.set(false);
    this.data.reload();
  }

  /* ── Falhar e cancelar ──────────────────────────────────────────────── */
  protected async fail(): Promise<void> {
    const link = this.link();
    if (!link || !this.canSimulate() || this.running()) return;

    this.running.set(true);
    const result = await this.commands.failLink(link.id);
    this.running.set(false);

    if (!result.ok) {
      this.actionError.set(result.failure.message);
      return;
    }
    this.data.reload();
  }

  protected readonly cancelOpen = signal(false);

  protected askCancel(): void {
    if (!this.canCancel()) return;
    this.actionError.set('');
    this.cancelOpen.set(true);
  }

  protected closeCancel(): void {
    if (this.running()) return;
    this.cancelOpen.set(false);
  }

  protected async cancel(): Promise<void> {
    const link = this.link();
    if (!link || this.running()) return;

    this.running.set(true);
    const result = await this.commands.cancelLink(link.id);
    this.running.set(false);

    if (!result.ok) {
      this.actionError.set(result.failure.message);
      return;
    }

    this.cancelOpen.set(false);
    this.data.reload();
  }

  /* ── Leitura ────────────────────────────────────────────────────────── */
  protected reload(): void {
    this.data.reload();
  }

  protected tone(status: string) {
    return linkTone(status);
  }

  protected title(): string {
    const link = this.link();
    return link?.title || link?.description || 'Link avulso';
  }

  protected stateTitle(): string {
    const link = this.link();
    if (!link) return '';
    if (link.status === 'PAID') return 'Pago, e a cobrança fechou';
    if (link.status === 'CANCELLED') return 'Cancelado';
    if (link.status === 'EXPIRED') return 'Expirado';
    if (link.failedPaymentCount > 0) return 'Aberto, com tentativas que falharam';
    return 'Ativo, esperando alguém pagar';
  }

  protected stateNote(): string {
    const link = this.link();
    if (!link) return '';
    if (link.status === 'PAID') {
      return 'A cobrança foi convertida: a PixCharge está paga e novas tentativas ficam bloqueadas.';
    }
    if (link.status === 'CANCELLED') return 'Encerrado à mão, não aceita novas tentativas.';
    if (link.status === 'EXPIRED') return 'O prazo venceu; o checkout não aceita mais tentativas.';
    if (link.failedPaymentCount > 0) {
      return 'Cada falha gera um pagamento novo, mas a PixCharge segue aberta até uma confirmação, a expiração ou o cancelamento.';
    }
    return 'As tentativas aparecem aqui assim que o checkout gerar o primeiro pagamento.';
  }

  protected attemptLabel(attempt: { attemptNumber?: number; attemptCount?: number }): string {
    return `Tentativa ${attempt.attemptNumber ?? 1} de ${attempt.attemptCount ?? 1}`;
  }

  protected money(cents?: number | null): string {
    return ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
