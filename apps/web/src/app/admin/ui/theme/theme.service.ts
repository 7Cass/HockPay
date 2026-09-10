import { Injectable, effect, signal } from '@angular/core';

export type AdmTheme = 'light' | 'dark';
export type AdmDensity = 'compact' | 'cozy';

const THEME_KEY = 'hockpay.admin.theme';
const DENSITY_KEY = 'hockpay.admin.density';

/**
 * O tema e a densidade da mesa.
 *
 * Duas escolhas, e as duas são do operador e não do produto:
 *
 * - **tema**: quem passa oito horas numa tela de tabela num plantão noturno tem
 *   opinião formada sobre fundo claro. A primeira visita segue o sistema; a
 *   partir da primeira troca, segue a escolha.
 * - **densidade**: compacto é o padrão porque a pergunta de uma mesa é "quantas
 *   decisões cabem na tela". Confortável existe para o dia longo e para a tela
 *   projetada em reunião.
 *
 * As duas viram atributo na raiz do admin (`.adm-root[data-adm-theme]`), não no
 * `<html>`: o lojista divide a origem com a mesa, e não faz sentido o dashboard
 * dele escurecer porque um operador preferiu escuro.
 *
 * O armazenamento é `localStorage` com tudo protegido: modo anônimo, cota
 * estourada e navegador com dados de site bloqueados jogam em qualquer acesso,
 * e nenhum deles é motivo para a mesa não abrir.
 */
@Injectable({ providedIn: 'root' })
export class AdmThemeService {
  readonly theme = signal<AdmTheme>(readTheme());
  readonly density = signal<AdmDensity>(readDensity());

  constructor() {
    effect(() => write(THEME_KEY, this.theme()));
    effect(() => write(DENSITY_KEY, this.density()));
  }

  toggleTheme(): void {
    this.theme.update((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  toggleDensity(): void {
    this.density.update((current) => (current === 'cozy' ? 'compact' : 'cozy'));
  }
}

function readTheme(): AdmTheme {
  const stored = read(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;

  return prefersDark() ? 'dark' : 'light';
}

function readDensity(): AdmDensity {
  return read(DENSITY_KEY) === 'cozy' ? 'cozy' : 'compact';
}

function prefersDark(): boolean {
  /* jsdom não tem `matchMedia`, e um teste de componente não deveria precisar
     saber disso para renderizar. */
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Preferência que não persiste ainda vale para esta sessão. */
  }
}
