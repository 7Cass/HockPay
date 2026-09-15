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

  it('os templates não herdam classe global do dashboard antigo', () => {
    // `panel`, `btn`, `chip` e companhia moram em `styles/primitives.css`, que é
    // global. Usá-las aqui traria a pele antiga de volta pela porta dos fundos.
    const legacy = /\b(panel|btn|btn-[a-z]+|chip|field|field-label|stat|table|eyebrow)\b/;
    const offenders = templates
      .filter((file) =>
        [...readFileSync(file, 'utf8').matchAll(/class="([^"]*)"/g)].some((match) =>
          match[1].split(/\s+/).some((name) => legacy.test(name) && !name.startsWith('mer-')),
        ),
      )
      .map(short);

    expect(offenders).toEqual([]);
  });
});

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
