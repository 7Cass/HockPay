import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCommand,
  lucideKeyboard,
  lucideLogOut,
  lucideMoon,
  lucideRows3,
  lucideStore,
  lucideSun,
} from '@ng-icons/lucide';
import { filter } from 'rxjs';

import { OperatorAuthService } from '../../services/operator-auth.service';
import {
  AdmButton,
  type AdmCommand,
  AdmCommandPalette,
  AdmKbd,
  AdmSheet,
  AdmThemeService,
  AdmToastService,
  AdmToaster,
} from '../../ui';
import { ADMIN_NAV } from './admin-nav';
import { AdminRail } from './admin-rail';

/** O que a tecla `g` espera depois dela, e por quanto tempo. */
const CHORD_WINDOW = 1200;

/**
 * A casca do admin: coluna à esquerda, área de trabalho à direita.
 *
 * O shell é a raiz do tema (`.adm-root`), o dono do teclado e o lugar onde a
 * sessão termina. O desenho da coluna é do `AdminRail`, e é uma divisão de
 * responsabilidade e não de arquivo: a coluna é só navegação e crachá, e nada
 * do que ela mostra depende de qual tela está aberta.
 *
 * O teclado é o que o shell carrega de mais próprio. `⌘K` abre a paleta, `g f` e
 * `g t` trocam de tela, `?` abre a lista de atalhos. Um console de pagamentos é
 * operado por quem passa o dia nele; a diferença entre mouse e teclado, ao longo
 * de uma fila de trinta lojas, é medida em minutos.
 */
@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    NgIcon,
    AdminRail,
    AdmButton,
    AdmCommandPalette,
    AdmKbd,
    AdmSheet,
    AdmToaster,
  ],
  providers: [
    provideIcons({
      lucideCommand,
      lucideKeyboard,
      lucideLogOut,
      lucideMoon,
      lucideRows3,
      lucideStore,
      lucideSun,
    }),
  ],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.css',
  host: {
    class: 'adm-root',
    '[attr.data-adm-theme]': 'theme.theme()',
    '[attr.data-adm-density]': 'theme.density()',
    '(window:keydown)': 'onKeydown($event)',
  },
})
export class AdminShell {
  protected readonly operatorAuth = inject(OperatorAuthService);
  protected readonly theme = inject(AdmThemeService);
  private readonly toast = inject(AdmToastService);
  private readonly router = inject(Router);

  protected readonly nav = ADMIN_NAV;
  protected readonly isLeaving = signal(false);
  protected readonly isPaletteOpen = signal(false);
  protected readonly isShortcutsOpen = signal(false);

  /** O que foi digitado na paleta, para os comandos que dependem disso. */
  private readonly paletteQuery = signal('');

  /** A rota de agora, para o rótulo da barra de cima. */
  private readonly url = signal(this.router.url);

  protected readonly section = computed(() => {
    const url = this.url();
    if (url.startsWith('/operator/stores/')) return 'Investigação de loja';
    const item = [...this.nav].reverse().find((entry) => url.startsWith(entry.route));
    return item?.label ?? 'Admin';
  });

  /**
   * O que a paleta oferece.
   *
   * Os destinos e as preferências são fixos; "abrir loja" só existe quando o
   * que está digitado tem cara de identificador. É a razão de a paleta devolver
   * o que foi digitado: o comando que a mesa mais usa — colar o id que veio no
   * chamado e cair na loja — não é uma lista, é uma leitura do que foi colado.
   */
  protected readonly commands = computed<readonly AdmCommand[]>(() => {
    const commands: AdmCommand[] = this.nav.map((item) => ({
      id: `nav:${item.route}`,
      group: 'Ir para',
      label: item.label,
      hint: item.hint,
      icon: item.icon,
      keywords: item.hint,
      run: () => void this.router.navigate([item.route]),
    }));

    const candidate = this.paletteQuery().trim();
    if (looksLikeId(candidate)) {
      commands.push({
        id: 'store:open',
        group: 'Loja',
        label: `Abrir loja ${candidate}`,
        hint: 'grava investigação na trilha',
        icon: 'lucideStore',
        run: () => void this.router.navigate(['/operator/stores', candidate]),
      });
    }

    commands.push(
      {
        id: 'theme',
        group: 'Preferências',
        label: 'Alternar tema',
        hint: this.theme.theme() === 'dark' ? 'escuro' : 'claro',
        icon: this.theme.theme() === 'dark' ? 'lucideMoon' : 'lucideSun',
        keywords: 'claro escuro dark light',
        run: () => this.theme.toggleTheme(),
      },
      {
        id: 'density',
        group: 'Preferências',
        label: 'Alternar densidade',
        hint: this.theme.density() === 'cozy' ? 'confortável' : 'compacta',
        icon: 'lucideRows3',
        keywords: 'linha altura compacto confortavel',
        run: () => this.theme.toggleDensity(),
      },
      {
        id: 'shortcuts',
        group: 'Preferências',
        label: 'Atalhos de teclado',
        hint: '?',
        icon: 'lucideKeyboard',
        run: () => this.isShortcutsOpen.set(true),
      },
      {
        id: 'logout',
        group: 'Sessão',
        label: 'Sair do admin',
        icon: 'lucideLogOut',
        keywords: 'encerrar sessao logout',
        run: () => this.logout(),
      },
    );

    return commands;
  });

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.url.set(event.urlAfterRedirects));
  }

  protected openPalette(): void {
    this.paletteQuery.set('');
    this.isPaletteOpen.set(true);
  }

  protected onPaletteQuery(query: string): void {
    this.paletteQuery.set(query);
  }

  protected logout(): void {
    if (this.isLeaving()) return;
    this.isLeaving.set(true);

    this.operatorAuth.logout().subscribe({
      next: () => {
        void this.router.navigate(['/operator/login']);
      },
      error: () => {
        this.isLeaving.set(false);
        this.toast.bad('Não foi possível encerrar a sessão.');
      },
    });
  }

  /** A tecla que ficou pendurada esperando a segunda — hoje, só o `g`. */
  private chord: { key: string; at: number } | null = null;

  protected onKeydown(event: KeyboardEvent): void {
    const meta = event.metaKey || event.ctrlKey;

    if (meta && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openPalette();
      return;
    }

    /* Dentro de um campo, letra é texto. Um atalho de uma tecla só que rouba o
       "f" de quem está escrevendo o motivo de uma suspensão é pior do que não
       ter atalho nenhum. */
    if (meta || event.altKey || isTyping(event.target)) return;

    if (event.key === '?') {
      event.preventDefault();
      this.isShortcutsOpen.set(true);
      return;
    }

    const pending = this.chord;
    this.chord = null;

    if (pending && Date.now() - pending.at < CHORD_WINDOW) {
      const destination = this.nav.find((item) => item.key === event.key.toLowerCase());
      if (destination) {
        event.preventDefault();
        void this.router.navigate([destination.route]);
      }
      return;
    }

    if (event.key.toLowerCase() === 'g') this.chord = { key: 'g', at: Date.now() };
  }
}

/**
 * O que a paleta aceita como identificador de loja.
 *
 * Deliberadamente frouxo: a mesa cola `cuid`, `uuid` e id curto de seed, e a
 * pergunta que importa não é "isto é um id válido" — é "isto pode ser um id, e
 * não uma busca por nome". Quem decide de verdade é a API, que responde 404.
 */
function looksLikeId(value: string): boolean {
  return value.length >= 8 && /^[a-z0-9][a-z0-9_-]*$/i.test(value);
}

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;

  const tag = element.tagName;
  return (
    tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable === true
  );
}
