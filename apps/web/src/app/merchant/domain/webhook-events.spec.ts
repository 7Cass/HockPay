import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { EVENT_GROUPS, SUBSCRIBABLE_EVENTS, eventLabel, eventSummary } from './webhook-events';

/**
 * O teste que mata a defasagem do espelho.
 *
 * `EVENT_GROUPS` é escrito à mão porque o console não importa de
 * `packages/core` — mas "escrito à mão" foi exatamente o que deixou a tela
 * antiga oferecer cinco eventos enquanto a API aceitava dez. Então aqui o
 * catálogo é lido **do disco**, no arquivo que o backend publica, e os dois
 * conjuntos precisam bater.
 *
 * Ler o arquivo em vez de importar o pacote é de propósito: importar criaria a
 * dependência que a fronteira proíbe no código de produção, e o teste passaria
 * a compilar `packages/core` inteiro para conferir catorze strings.
 */

const CATALOG = 'packages/core/src/domain/constants/event-catalog.ts';

/** Sobe do diretório do teste até achar a raiz do repositório. */
function findCatalog(): string {
  let dir = resolve(process.cwd());

  for (let depth = 0; depth < 10; depth++) {
    const candidate = join(dir, CATALOG);
    if (existsSync(candidate)) return candidate;

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(`não achei ${CATALOG} subindo a partir de ${process.cwd()}`);
}

/** Cada entrada do catálogo: o tipo do evento e como ele é entregue. */
function readCatalog(): { subscribable: string[]; manual: string[] } {
  const source = readFileSync(findCatalog(), 'utf8');
  const entries = [...source.matchAll(/^ {2}'([^']+)':\s*\{([\s\S]*?)^ {2}\},?$/gm)];

  const subscribable: string[] = [];
  const manual: string[] = [];

  for (const [, eventType, body] of entries) {
    const delivery = /delivery:\s*'(\w+)'/.exec(body)?.[1];
    if (delivery === 'subscribable') subscribable.push(eventType);
    else if (delivery === 'manual') manual.push(eventType);
  }

  return { subscribable, manual };
}

describe('espelho dos eventos', () => {
  const catalog = readCatalog();

  it('o catálogo foi lido de verdade', () => {
    // Se o formato do arquivo mudar e o parser parar de casar, o teste abaixo
    // passaria comparando dois conjuntos vazios. Esta é a âncora contra isso.
    expect(catalog.subscribable.length).toBeGreaterThan(5);
    expect(catalog.manual).toContain('webhook.test');
  });

  it('oferece exatamente os eventos que a API aceita assinar', () => {
    const offered = [...SUBSCRIBABLE_EVENTS].sort();
    const accepted = [...catalog.subscribable].sort();

    // A mensagem nomeia o que falta de cada lado: quem adicionar um evento em
    // `packages/core` lê daqui o que precisa traduzir.
    const missing = accepted.filter((event) => !offered.includes(event));
    const extra = offered.filter((event) => !accepted.includes(event));

    expect({ faltando: missing, sobrando: extra }).toEqual({ faltando: [], sobrando: [] });
  });

  it('não oferece disparo de teste como assinatura', () => {
    // `webhook.test` e `alert.test` chegam na mesma URL, mas não nascem do
    // outbox: assinar não muda nada, e oferecer mentiria.
    for (const event of catalog.manual) {
      expect(SUBSCRIBABLE_EVENTS).not.toContain(event);
    }
  });

  it('todo evento tem rótulo e dica próprios', () => {
    for (const group of EVENT_GROUPS) {
      for (const option of group.options) {
        expect(option.label).not.toBe(option.value);
        expect(option.hint.length).toBeGreaterThan(10);
      }
    }
  });

  it('nenhum evento aparece em dois grupos', () => {
    expect(new Set(SUBSCRIBABLE_EVENTS).size).toBe(SUBSCRIBABLE_EVENTS.length);
  });

  it('um tipo fora do catálogo aparece como veio', () => {
    expect(eventLabel('payment.legacy')).toBe('payment.legacy');
  });

  describe('resumo de uma assinatura', () => {
    it('conta quantos ficaram de fora', () => {
      expect(eventSummary(['payment.confirmed', 'payment.failed'])).toBe('Pagamento confirmado +1');
    });

    it('diz "todos" quando o destino assina o catálogo inteiro', () => {
      expect(eventSummary(SUBSCRIBABLE_EVENTS)).toBe('Todos os eventos');
    });

    it('não inventa evento quando não há nenhum', () => {
      expect(eventSummary([])).toBe('Nenhum evento');
    });
  });
});
