import { Component } from '@angular/core';

@Component({
    selector: 'app-webhooks',
    standalone: true,
    template: `
    <div class="flex flex-col gap-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-zinc-900">Webhooks</h1>
        <p class="text-sm text-zinc-500 mt-1">Acompanhe e configure callbacks para o seu sistema.</p>
      </div>

      <div class="flex-1 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 flex flex-col items-center justify-center py-24 text-center">
        <div class="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-600"><path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"/><path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06"/><path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8"/></svg>
        </div>
        <h3 class="text-lg font-semibold text-zinc-900 mb-1">Página em Construção</h3>
        <p class="text-sm text-zinc-500 max-w-sm">Em breve, será possível configurar URLs que receberão POSTs automáticos de cada transação do Hockpay.</p>
      </div>
    </div>
  `
})
export class Webhooks { }
