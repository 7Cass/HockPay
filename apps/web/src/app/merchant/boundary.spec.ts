import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/**
 * A fronteira do console, como teste.
 *
 * O PRD desenha quatro camadas numa direção só — `domain` <- `data` <- `ui` <-
 * `pages` — e uma costura única com o resto do app. Desenho que vive só em
 * documento dura até a primeira pressa. Este arquivo varre os imports da pasta
 * e falha quando a direção inverte.
 *
 * O idioma não é novo aqui: a API tem `operator-read-no-secrets.spec.ts`, que
 * percorre as rotas de leitura da mesa por reflexão e falha se alguma passar a
 * devolver segredo. A regra que importa é a que quebra o build.
 */

const MERCHANT = findMerchantDir();

/** Pacote externo (`@angular/core`, `rxjs`) — nada a ver com a fronteira. */
const isPackage = (specifier: string) => !specifier.startsWith('.');

describe('fronteira do console', () => {
  const files = walk(MERCHANT).filter((file) => file.endsWith('.ts'));
  const templates = walk(MERCHANT).filter((file) => file.endsWith('.html'));

  it('encontra os arquivos do console', () => {
    // Guarda contra o próprio teste: caminho errado passaria em tudo calado.
    expect(files.length).toBeGreaterThan(0);
  });

  it('só a costura aponta para fora de merchant/', () => {
    const leaks = files.flatMap((file) =>
      importsOf(file)
        .filter((specifier) => !isPackage(specifier))
        .filter((specifier) => !inside(resolve(dirname(file), specifier)))
        .map((specifier) => `${short(file)} -> ${specifier}`),
    );

    expect(leaks.filter((leak) => !leak.startsWith('domain/api-contracts.ts'))).toEqual([]);
  });

  it('nenhuma peça de tela de fora entra no console', () => {
    const forbidden = [
      'shared/ui',
      'libs/ui',
      '@spartan-ng',
      'ngx-sonner',
      'apexcharts',
      '/admin/',
    ];
    const found = files.flatMap((file) =>
      importsOf(file)
        .filter((specifier) => forbidden.some((name) => specifier.includes(name)))
        .map((specifier) => `${short(file)} -> ${specifier}`),
    );

    expect(found).toEqual([]);
  });

  it('domain/ não conhece Angular', () => {
    // Tipos, vocabulário e regra de leitura. A exceção é a costura, que
    // reexporta serviços — e serviço é Angular por definição.
    const offenders = files
      .filter((file) => short(file).startsWith('domain/'))
      .filter((file) => !short(file).endsWith('api-contracts.ts'))
      .filter((file) => importsOf(file).some((specifier) => specifier.startsWith('@angular/')))
      .map(short);

    expect(offenders).toEqual([]);
  });

  it('ui/ não faz HTTP nem conhece data/', () => {
    const offenders = files
      .filter((file) => short(file).startsWith('ui/'))
      .filter((file) => {
        const specifiers = importsOf(file);
        const source = readFileSync(file, 'utf8');
        return (
          specifiers.some((name) => name.includes('/data/') || name.includes('api-contracts')) ||
          /\b(httpResource|HttpClient|ApiClientService)\b/.test(source)
        );
      })
      .map(short);

    expect(offenders).toEqual([]);
  });

  it('data/ não conhece tela', () => {
    const offenders = files
      .filter((file) => short(file).startsWith('data/'))
      .filter((file) =>
        importsOf(file).some((name) => name.includes('/ui/') || name.includes('/pages/')),
      )
      .map(short);

    expect(offenders).toEqual([]);
  });

  it('ninguém chama um recurso como se fosse função', () => {
    // `httpResource` devolve uma **referência**: o valor se lê com `.value()`.
    // Chamar `this.conta()` compila como erro só no build de template, que os
    // specs não rodam — eu cometi esse erro três vezes seguidas antes de
    // transformá-lo em teste. O guarda acha a declaração (`x = algoResource(`)
    // e procura `x()` no componente e no template irmão.
    const offenders: string[] = [];

    // O próprio teste fala sobre o padrão que procura, e os specs declaram
    // dublês — nenhum dos dois é tela. Varrer só o código de produção.
    for (const file of files.filter((path) => !path.endsWith('.spec.ts'))) {
      const source = readFileSync(file, 'utf8');
      const declared = [...source.matchAll(/(\w+)\s*=\s*\w*[Rr]esource\(/g)].map((m) => m[1]);
      if (declared.length === 0) continue;

      const markup = readIfExists(file.replace(/\.ts$/, '.html'));
      const template = file.replace(/\.ts$/, '.html');

      for (const name of declared) {
        const called = new RegExp(`(this\\.)?\\b${name}\\(\\)`);
        if (called.test(source.replace(new RegExp(`${name}\\s*=\\s*\\w*[Rr]esource\\(`), '')))
          offenders.push(`${short(file)} -> ${name}()`);
        else if (markup && called.test(markup)) offenders.push(`${short(template)} -> ${name}()`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('os templates não herdam classe global do dashboard antigo', () => {
    // As classes de `styles/primitives.css` são globais e vivem em
    // `@layer components`: o que o componente não sobrescreve vaza para cá. Usar
    // uma delas traria a pele antiga de volta pela porta dos fundos.
    //
    // A comparação é por **token inteiro**, e não por pedaço: `icon-btn` é uma
    // classe local e encapsulada, e um teste que casasse `btn` dentro dela
    // proibiria nome legítimo — que foi o primeiro jeito que este teste teve, e
    // o motivo de ele estar assim documentado.
    const offenders = templates
      .filter((file) =>
        [...readFileSync(file, 'utf8').matchAll(/class="([^"]*)"/g)].some((match) =>
          match[1].split(/\s+/).some((name) => LEGACY_CLASSES.has(name)),
        ),
      )
      .map(short);

    expect(offenders).toEqual([]);
  });
});

/**
 * As classes que `styles/primitives.css` publica no escopo global, extraídas
 * dele (`grep -ohE '^\s*\.[a-z][a-z0-9-]*'`, 92 nomes em `2026-09-15`).
 *
 * A lista é literal de propósito: lê-la do CSS em tempo de teste faria o teste
 * passar sozinho no dia em que alguém renomeasse a primitiva, que é justamente
 * o dia em que se quer olhar para cá.
 */
const LEGACY_CLASSES = new Set([
  'arrow',
  'arrow-back',
  'arrow-diag',
  'btn',
  'btn-danger',
  'btn-ghost',
  'btn-icon',
  'btn-ink',
  'btn-lg',
  'btn-paper',
  'btn-quiet',
  'btn-sm',
  'cell-actions',
  'cell-link',
  'cell-stack',
  'cell-sub',
  'cell-title',
  'chip',
  'chip-bare',
  'control',
  'control-icon',
  'detail-column',
  'detail-grid',
  'eyebrow',
  'fact',
  'fact-stacked',
  'facts',
  'facts-split',
  'field',
  'field-error',
  'field-label',
  'field-note',
  'filter-actions',
  'filter-bar',
  'form-row',
  'form-stack',
  'group',
  'ink-field',
  'input',
  'label',
  'link',
  'mark',
  'mark-bar',
  'mark-dot',
  'mark-inverse',
  'menu',
  'menu-check',
  'menu-empty',
  'menu-label',
  'menu-row',
  'menu-rule',
  'menu-sub',
  'menu-text',
  'menu-title',
  'meter',
  'mono',
  'notice',
  'notice-text',
  'numeric',
  'panel',
  'panel-body',
  'panel-head',
  'panel-quiet',
  'panel-title',
  'pulse-dot',
  'reveal',
  'reveal-in',
  'scroll-thin',
  'seg',
  'skeleton',
  'spinner',
  'spinner-sm',
  'stat',
  'stat-context',
  'stat-delta',
  'stat-head',
  'stat-value',
  'switch',
  'switch-label',
  'switch-track',
  'table',
  'table-scroll',
  'timeline',
  'timeline-head',
  'timeline-label',
  'timeline-meta',
  'timeline-note',
  'timeline-when',
  'toggle',
]);

function findMerchantDir(): string {
  const candidates = [
    join(process.cwd(), 'src/app/merchant'),
    join(process.cwd(), 'apps/web/src/app/merchant'),
  ];
  const found = candidates.find((path) => {
    try {
      return statSync(path).isDirectory();
    } catch {
      return false;
    }
  });

  if (!found) throw new Error(`nao achei merchant/ a partir de ${process.cwd()}`);
  return found;
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/** O template irmão de um componente, ou vazio quando ele não existe. */
function readIfExists(file: string): string {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const specifiers = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);
  const dynamic = [...source.matchAll(/import\(\s*'([^']+)'\s*\)/g)].map((match) => match[1]);
  return [...specifiers, ...dynamic];
}

function inside(path: string): boolean {
  const rel = relative(MERCHANT, path);
  return !rel.startsWith('..');
}

function short(file: string): string {
  return relative(MERCHANT, file);
}
