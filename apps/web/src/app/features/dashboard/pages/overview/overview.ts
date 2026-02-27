import { Component } from '@angular/core';

@Component({
  selector: 'app-overview',
  standalone: true,
  template: `
    <div class="flex flex-col gap-6">
      <!-- Page Header -->
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-zinc-900">Visão Geral</h1>
        <p class="text-sm text-zinc-500 mt-1">Acompanhe as métricas e o desempenho da sua loja em tempo real.</p>
      </div>

      <!-- Placeholder Content -->
      <div class="flex-1 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 flex flex-col items-center justify-center py-24 text-center">
        <div class="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-600">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            <line x1="3" x2="21" y1="9" y2="9"/>
            <path d="M9 21V9"/>
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-zinc-900 mb-1">Dashboard em Desenvolvimento</h3>
        <p class="text-sm text-zinc-500 max-w-sm">Os gráficos, indicadores e resumos financeiros estarão disponíveis nesta tela em breve.</p>
      </div>
    </div>
  `
})
export class Overview { }
