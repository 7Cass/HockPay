import { Prisma } from '@hockpay/database';

/**
 * Normaliza um `Date` para timestamp naive em UTC dentro de SQL cru.
 *
 * As colunas de data do schema sao `timestamp without time zone`, e o Prisma
 * grava nelas sempre em UTC quando a escrita passa pelo ORM. Ja um `Date`
 * interpolado em `$queryRaw` chega como `timestamptz` e o Postgres o converte
 * usando o **timezone da sessao**. Numa sessao UTC os dois lados coincidem e
 * tudo funciona; em qualquer outra (a maquina do dev costuma ser local) a
 * comparacao passa a confrontar um instante UTC com uma hora local.
 *
 * O efeito nao e um erro: e um predicado que simplesmente nunca casa. Foi assim
 * que o dispatcher de outbox parou de entregar webhook em sessao
 * `America/Sao_Paulo`, sem nada em log.
 *
 * `AT TIME ZONE 'UTC'` traz o parametro de volta para o mesmo referencial da
 * coluna, tornando a comparacao independente do timezone da sessao.
 *
 * Use em toda comparacao e toda escrita de data em SQL cru:
 *
 * ```ts
 * Prisma.sql`WHERE "next_retry_at" <= ${utcTimestamp(now)}`
 * ```
 */
export function utcTimestamp(value: Date): Prisma.Sql {
  return Prisma.sql`${value}::timestamptz AT TIME ZONE 'UTC'`;
}
