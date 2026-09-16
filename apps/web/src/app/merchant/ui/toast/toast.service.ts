import { Injectable, signal } from '@angular/core';

import type { Tone } from '../../domain/tone';

export interface MerToast {
  readonly id: number;
  readonly tone: Tone;
  readonly message: string;
  /** A segunda linha: o detalhe que não cabe no aviso curto. */
  readonly detail?: string;
}

/** Quanto tempo cada tom fica na tela, em milissegundos. */
const LIFETIME: Record<Tone, number> = {
  ok: 4000,
  neutral: 5000,
  warn: 7000,
  /* O erro fica mais tempo: é o único que o lojista talvez precise ler duas
     vezes, e às vezes copiar para o chamado. */
  bad: 9000,
};

/**
 * O aviso do que o console acabou de fazer.
 *
 *   private readonly toast = inject(MerToastService);
 *   this.toast.ok('Chave criada. Copie agora: ela não aparece de novo.');
 *   this.toast.bad('Não foi possível criar a chave.', failure.message);
 *
 * Existe em vez de uma biblioteca porque o que o console precisa cabe em
 * quarenta linhas — uma fila, um relógio por item e um tom. O admin chegou a
 * essa mesma conclusão em `caa1174`, e foi assim que ele se livrou do
 * `ngx-sonner`; aqui o motivo é o mesmo, e o código é próprio porque as duas
 * pastas não se importam.
 *
 * O serviço é `root` e a fila é um sinal: qualquer tela pede um aviso, e quem
 * desenha é o `<mer-toaster>` que a casca monta uma vez.
 */
@Injectable({ providedIn: 'root' })
export class MerToastService {
  private nextId = 1;

  readonly toasts = signal<readonly MerToast[]>([]);

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
    this.push('neutral', message, detail);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }

  private push(tone: Tone, message: string, detail?: string): void {
    const id = this.nextId++;

    /* Três é o teto: uma pilha maior cobre a tabela que o lojista está lendo,
       e o quarto aviso quase sempre repete o terceiro. */
    this.toasts.update((list) => [...list.slice(-2), { id, tone, message, detail }]);

    setTimeout(() => this.dismiss(id), LIFETIME[tone]);
  }
}
