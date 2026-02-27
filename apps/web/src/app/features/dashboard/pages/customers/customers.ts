import { Component } from '@angular/core';

@Component({
    selector: 'app-customers',
    standalone: true,
    template: `
    <div class="flex flex-col gap-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-zinc-900">Clientes</h1>
        <p class="text-sm text-zinc-500 mt-1">Gerencie a base de clientes da sua loja.</p>
      </div>

      <div class="flex-1 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 flex flex-col items-center justify-center py-24 text-center">
        <div class="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-600"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <h3 class="text-lg font-semibold text-zinc-900 mb-1">Página em Construção</h3>
        <p class="text-sm text-zinc-500 max-w-sm">A gestão de clientes está em desenvolvimento. Acompanhe a documentação para novidades.</p>
      </div>
    </div>
  `
})
export class Customers { }
