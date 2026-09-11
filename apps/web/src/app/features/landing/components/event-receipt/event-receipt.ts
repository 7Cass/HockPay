import { Component, computed, input } from '@angular/core';

export interface ReceiptLine {
  readonly id: number;
  readonly name: string;
  readonly note: string;
  readonly tone: 'neutral' | 'ok' | 'bad' | 'warn';
  readonly time: string;
}

type ReceiptStatus = 'idle' | 'pending' | 'confirmed' | 'failed' | 'expired';

const STAMPS: Partial<Record<ReceiptStatus, string>> = {
  confirmed: 'PAGO',
  failed: 'RECUSADO',
  expired: 'EXPIRADO',
};

/**
 * The event stream as a thermal receipt: each event prints in, left to right,
 * and a rubber stamp lands once the charge has an ending.
 */
@Component({
  selector: 'app-event-receipt',
  templateUrl: './event-receipt.html',
  styleUrl: './event-receipt.css',
})
export class EventReceipt {
  readonly lines = input.required<readonly ReceiptLine[]>();
  readonly status = input.required<ReceiptStatus>();

  protected readonly today = new Date().toLocaleDateString('pt-BR');
  protected readonly stamp = computed(() => STAMPS[this.status()] ?? '');
}
