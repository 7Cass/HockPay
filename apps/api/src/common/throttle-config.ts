/**
 * Limites de rate limit lidos do ambiente.
 *
 * Os decorators `@Throttle` sao avaliados no carregamento do modulo, antes de
 * qualquer injecao, entao a leitura e direta em `process.env` — que o
 * ConfigModule ja preenche a partir do `.env`. Os defaults sao os valores de
 * producao; o smoke de volume sobe os tetos porque dispara centenas de
 * requisicoes do mesmo IP em segundos.
 */
export function readThrottleEnv(key: string, fallback: number): number {
  const parsed = Number(process.env[key]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Janela padrao de todos os limites, em ms. */
export const THROTTLE_TTL_MS = readThrottleEnv('THROTTLE_TTL_MS', 60_000);

/** Teto global por IP em cada janela. */
export const THROTTLE_LIMIT = readThrottleEnv('THROTTLE_LIMIT', 100);

/** Teto de tentativas de login por IP — protecao contra forca bruta. */
export const THROTTLE_LOGIN_LIMIT = readThrottleEnv('THROTTLE_LOGIN_LIMIT', 5);
