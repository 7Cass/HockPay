import { Component } from '@angular/core';

@Component({
    selector: 'app-payments',
    standalone: true,
    template: `
    <div class="flex flex-col gap-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-zinc-900">Pagamentos</h1>
        <p class="text-sm text-zinc-500 mt-1">Gerencie e visualize todas as transações da sua loja.</p>
      </div>

      <div class="flex-1 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 flex flex-col items-center justify-center py-24 text-center">
        <div class="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-600"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
        </div>
        <h3 class="text-lg font-semibold text-zinc-900 mb-1">Página em Construção</h3>
        <p class="text-sm text-zinc-500 max-w-sm">A listagem completa de pagamentos estará disponível em breve. Por enquanto, utilize o Swagger da API para interagir.</p>
      </div>
    </div>
  `
})
export class Payments { }
