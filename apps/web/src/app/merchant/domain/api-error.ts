/**
 * A falha da API, como o console a entende.
 *
 * Hoje cada tela lê `err.error?.error?.message` na unha e joga o resto fora —
 * inclusive o `code`, que é a única parte estável do envelope. O dashboard
 * antigo guarda o resultado disso numa string solta (`errorState`), e uma tela
 * que só tem a frase não consegue decidir nada: não dá para distinguir "a loja
 * não está habilitada para LIVE" de "o servidor caiu".
 *
 * O envelope vem dos filtros da API (`DomainExceptionFilter`,
 * `HttpExceptionFilter`, `PrismaExceptionFilter`):
 *
 *     { error: { code, message, statusCode, timestamp, path, requestId } }
 *
 * Este arquivo é domínio: não importa Angular, e recebe `unknown` justamente
 * para não depender de `HttpErrorResponse`. Ele aceita o que vier e devolve
 * sempre a mesma forma — inclusive quando o que vier não for um erro da API.
 */
export interface ApiFailure {
  /** O código da API (`STORE_LIVE_NOT_ENABLED`), ou um dos dois locais. */
  readonly code: string;
  /** Frase pronta para a tela, em português. */
  readonly message: string;
  /** HTTP status; `0` quando o servidor não respondeu. */
  readonly status: number;
  /** O que o suporte pede quando o lojista abre um chamado. */
  readonly requestId?: string;
}

/** O servidor não respondeu: rede, CORS, API fora do ar. */
export const NETWORK_FAILURE = 'NETWORK_UNREACHABLE';

/** Respondeu, mas não no formato da casa. */
export const UNKNOWN_FAILURE = 'UNKNOWN_ERROR';

const NETWORK_MESSAGE = 'O servidor não respondeu. Verifique a conexão e tente de novo.';

export function toApiFailure(error: unknown, fallback = 'Não foi possível completar.'): ApiFailure {
  const status = numberAt(error, 'status') ?? 0;

  // `status 0` é o navegador dizendo que a requisição não chegou a lugar nenhum.
  // A mensagem do `HttpErrorResponse` aqui fala de "Unknown Error" e só assusta.
  if (status === 0) {
    return { code: NETWORK_FAILURE, message: NETWORK_MESSAGE, status: 0 };
  }

  const envelope = at(at(error, 'error'), 'error');
  const code = stringAt(envelope, 'code');
  const message = stringAt(envelope, 'message');

  if (code && message) {
    return { code, message, status, requestId: stringAt(envelope, 'requestId') };
  }

  return {
    code: UNKNOWN_FAILURE,
    message: message ?? stringAt(error, 'message') ?? fallback,
    status,
  };
}

function at(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function stringAt(value: unknown, key: string): string | undefined {
  const found = at(value, key);
  return typeof found === 'string' && found.length > 0 ? found : undefined;
}

function numberAt(value: unknown, key: string): number | undefined {
  const found = at(value, key);
  return typeof found === 'number' ? found : undefined;
}
