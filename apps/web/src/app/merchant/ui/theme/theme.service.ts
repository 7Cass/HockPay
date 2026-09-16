import { Injectable, computed, signal } from '@angular/core';

/** `night` é o padrão declarado; `paper` é escolha; `system` segue o aparelho. */
export type MerTheme = 'night' | 'paper' | 'system';

/** A pele que a raiz do console aplica — `system` já resolvido. */
export type MerSkin = 'night' | 'paper';

const THEME_KEY = 'hockpay.merchant.theme';

/**
 * A pele do console.
 *
 * Carvão é o padrão porque a jornada chega escura: a landing é carvão, o login
 * é carvão, e abrir o console num creme faria o produto parecer outro site. O
 * papel existe porque ler uma coluna de dinheiro por uma hora é outro trabalho
 * — e por isso é escolha do lojista, não do produto.
 *
 * A escolha vira atributo na raiz do console (`.mer-root[data-mer-theme]`), e
 * não no `<html>`: a mesa divide a origem com o lojista, e o console de um
 * operador aberto na outra aba não clareia porque um lojista preferiu papel.
 *
 * `system` existe para quem já configurou o aparelho e espera que o site
 * obedeça. A gravação é explícita, no método que muda a escolha, e não num
 * `effect`: são dois pontos de escrita no arquivo inteiro, e um `effect` aqui
 * só adiciona um ciclo que o teste precisaria avançar para ver o que já era
 * síncrono.
 *
 * O armazenamento é `localStorage` com tudo protegido: modo anônimo, cota
 * estourada e navegador com dados de site bloqueados jogam em qualquer acesso,
 * e nenhum deles é motivo para o console não abrir.
 */
@Injectable({ providedIn: 'root' })
export class MerThemeService {
  private readonly choice = signal<MerTheme>(readTheme());

  /** O que o lojista escolheu, incluindo `system`. */
  readonly theme = this.choice.asReadonly();

  /** O que a raiz recebe: `night` ou `paper`, nunca `system`. */
  readonly resolved = computed<MerSkin>(() => resolveSkin(this.choice()));

  set(theme: MerTheme): void {
    this.choice.set(theme);
    write(THEME_KEY, theme);
  }

  /** O botão da casca: alterna entre as duas peles concretas. */
  toggle(): void {
    this.set(this.resolved() === 'night' ? 'paper' : 'night');
  }
}

function readTheme(): MerTheme {
  const stored = read(THEME_KEY);
  return stored === 'night' || stored === 'paper' || stored === 'system' ? stored : 'night';
}

function resolveSkin(theme: MerTheme): MerSkin {
  if (theme !== 'system') return theme;
  return prefersLight() ? 'paper' : 'night';
}

/**
 * Só `light` explícito tira o console do carvão. `no-preference` e ambiente sem
 * `matchMedia` (jsdom, por exemplo) continuam no padrão declarado.
 */
function prefersLight(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-color-scheme: light)').matches;
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
