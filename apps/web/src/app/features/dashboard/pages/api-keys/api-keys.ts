import { Component } from '@angular/core';

@Component({
    selector: 'app-api-keys',
    standalone: true,
    template: `
    <div class="flex flex-col gap-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-zinc-900">Chaves de API</h1>
        <p class="text-sm text-zinc-500 mt-1">Crie e gerencie chaves para integração com nosso Gateway.</p>
      </div>

      <div class="flex-1 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 flex flex-col items-center justify-center py-24 text-center">
        <div class="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-600"><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/></svg>
        </div>
        <h3 class="text-lg font-semibold text-zinc-900 mb-1">Página em Construção</h3>
        <p class="text-sm text-zinc-500 max-w-sm">Você poderá criar chaves PK_TEST e SK_TEST para transacionar no Sandbox de desenvolvimento em breve.</p>
      </div>
    </div>
  `
})
export class ApiKeys { }
