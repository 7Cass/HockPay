/**
 * Os parâmetros de uma lista, e a regra de como eles moram na URL.
 *
 * O dashboard antigo faz isso na mão em duas telas, com `queryParamMap`,
 * `parsePositiveInt` e `updateQueryParams` copiados entre elas — e o resto das
 * listas simplesmente não guarda filtro nenhum na URL, então um filtro aplicado
 * morre no F5 e não se manda por mensagem para o suporte.
 *
 * As regras, num lugar só:
 *
 * - **o padrão não aparece na URL.** `?page=1&limit=20` é ruído: quem lê a
 *   barra de endereço deve ver o que foi escolhido, não o que já era.
 * - **número é lido estrito.** `?page=abc` vira o padrão, e não `NaN` — que é
 *   exatamente o achado aberto das rotas da mesa, que a tela não vai repetir.
 * - **texto vazio é ausência.** Filtro limpo não fica pendurado como `?q=`.
 *
 * Isto é domínio: funções puras, sem Angular e sem `Router`. A fiação com a URL
 * mora em `data/list-query.ts`, e é fina o bastante para caber num teste de
 * integração só.
 */
export type ListParamValue = string | number;
export type ListParams = Readonly<Record<string, ListParamValue>>;

/** Como a URL entrega um parâmetro: presente com valor, ou ausente. */
export type RawParam = (key: string) => string | null;

/**
 * Lê os parâmetros da URL sobre os padrões.
 *
 * O tipo do padrão decide como o valor é lido: onde o padrão é número, o valor
 * precisa ser um número finito para valer; onde é texto, vale o texto não vazio.
 */
export function readListParams<T extends ListParams>(defaults: T, raw: RawParam): T {
  const read: Record<string, ListParamValue> = {};

  for (const [key, fallback] of Object.entries(defaults)) {
    const value = raw(key);

    if (value === null || value === '') {
      read[key] = fallback;
      continue;
    }

    if (typeof fallback === 'number') {
      const parsed = Number(value);
      read[key] = Number.isFinite(parsed) ? parsed : fallback;
      continue;
    }

    read[key] = value;
  }

  return read as T;
}

/**
 * O que a URL deve passar a mostrar.
 *
 * `null` apaga o parâmetro — é como o `Router` do Angular remove uma chave —, e
 * é o que acontece com todo valor igual ao padrão.
 */
export function writeListParams<T extends ListParams>(
  defaults: T,
  value: T,
): Record<string, string | null> {
  const written: Record<string, string | null> = {};

  for (const key of Object.keys(defaults)) {
    const current = value[key];
    written[key] = current === defaults[key] || current === '' ? null : String(current);
  }

  return written;
}
