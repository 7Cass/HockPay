import { Injectable, signal } from '@angular/core';

import type { Tone } from '../tone';

export interface AdmToast {
  readonly id: number;
  readonly tone: Tone;
  readonly message: string;
  /** A segunda linha: o detalhe que não cabe no aviso curto. */
  readonly detail?: string;
}

/** Quanto tempo cada tom fica na tela, em milissegundos. */
const LIFETIME: Record<Tone, number> = {
  ok: 4000,
  info: 5000,
  neutral: 5000,
  warn: 7000,
  /* O erro fica mais tempo: é o único que o operador talvez precise ler duas
     vezes, e às vezes copiar para o chamado. */
  bad: 9000,
};

/**
 * O aviso do que a mesa acabou de fazer.
 *
 *   private readonly toast = inject(AdmToastService);
 *   this.toast.ok('Condição comercial registrada, com linha na trilha.');
 *   this.toast.bad('Não foi possível registrar a decisão.', err.message);
 *
 * Existe em vez de uma biblioteca porque o que o admin precisa de um toast cabe
 * em quarenta linhas — uma fila, um relógio por item e um tom — e porque a
 * dependência que fazia isso (`ngx-sonner` pelo invólucro do spartan) era a
 * última coisa que amarrava esta pasta a uma lib de UI de fora. Sem ela, o
 * admin viaja inteiro para `apps/admin` sem levar `libs/ui` junto.
 *
 * O serviço é `root` e a fila é um sinal: qualquer tela pede um aviso, e quem
 * desenha é o `<adm-toaster>` que o shell (e a porta de entrada) montam uma vez.
 */
@Injectable({ providedIn: 'root' })
export class AdmToastService {
  private nextId = 1;

  readonly toasts = signal<readonly AdmToast[]>([]);

  ok(message: string, detail?: string): void {
    this.push('ok', message, detail);
  }

  bad(message: string, detail?: string): void {
    this.push('bad', message, detail);
  }

  warn(message: string, detail?: string): void {
    this.push('warn', message, detail);
  }

  info(message: string, detail?: string): void {
    this.push('info', message, detail);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }

  private push(tone: Tone, message: string, detail?: string): void {
    const id = this.nextId++;

    /* Três é o teto: uma pilha maior que isso cobre a tabela que o operador
       está lendo, e o quarto aviso quase sempre repete o terceiro. */
    this.toasts.update((list) => [...list.slice(-2), { id, tone, message, detail }]);

    setTimeout(() => this.dismiss(id), LIFETIME[tone]);
  }
}
