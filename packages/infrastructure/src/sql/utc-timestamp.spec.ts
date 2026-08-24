import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { Prisma } from '@hockpay/database';
import { utcTimestamp } from './utc-timestamp';

describe('utcTimestamp', () => {
  it('normaliza o parametro para o referencial da coluna', () => {
    const now = new Date('2026-08-24T17:24:00.000Z');
    const query = Prisma.sql`SELECT 1 WHERE "next_retry_at" <= ${utcTimestamp(now)}`;

    expect(query.sql.replace(/\s+/g, ' ')).toBe(
      `SELECT 1 WHERE "next_retry_at" <= ?::timestamptz AT TIME ZONE 'UTC'`,
    );
    expect(query.values).toEqual([now]);
  });
});

/**
 * Guard de regressao para a classe inteira de bug.
 *
 * Um `Date` interpolado cru em `$queryRaw` chega como `timestamptz` e o
 * Postgres o converte usando o timezone da sessao, enquanto o ORM grava as
 * colunas `timestamp` sempre em UTC. Em sessao nao-UTC o predicado deixa de
 * casar silenciosamente — foi assim que o dispatcher de outbox parou de
 * entregar webhook sem nada em log.
 */
describe('SQL cru nao compara data sem normalizar', () => {
  const repositoriesDir = resolve(__dirname, '../repositories');
  const COMPARISON = /"?(\w*_(?:at|date))"?\s*(?:<=|>=|<|>|=)\s*\$\{([^}]+)\}/g;

  const offenders = readdirSync(repositoriesDir)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .flatMap((file) => {
      const source = readFileSync(resolve(repositoriesDir, file), 'utf8');
      return [...source.matchAll(COMPARISON)]
        .filter(([, , param]) => !param.includes('utcTimestamp'))
        .map(([, column, param]) => `${file}: ${column} <op> \${${param}}`);
    });

  it('todo parametro de data em SQL cru passa por utcTimestamp', () => {
    expect(offenders).toEqual([]);
  });
});
