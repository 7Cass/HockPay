import { Injectable, Logger } from '@nestjs/common';
import {
  ThrottlerException,
  ThrottlerGuard,
  type ThrottlerRequest,
} from '@nestjs/throttler';

/**
 * ThrottlerGuard que nao derruba a API junto com o Redis.
 *
 * O contador de rate limit vive no Redis. Sem esse guard, uma queda do Redis
 * faz o guard estourar e o Nest responder 500 em **toda** requisicao — criar
 * pagamento, health check, login. Um limite de trafego e uma protecao, nao um
 * invariante de correcao: quando o contador some, o certo e deixar passar e
 * gritar no log, nao transformar uma indisponibilidade do cache em uma
 * indisponibilidade da plataforma.
 *
 * O 429 legitimo continua subindo intacto.
 */
@Injectable()
export class ResilientThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(ResilientThrottlerGuard.name);

  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    try {
      return await super.handleRequest(requestProps);
    } catch (error) {
      if (error instanceof ThrottlerException) {
        throw error;
      }

      this.logger.error(
        `Rate limit storage unavailable, allowing the request through: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return true;
    }
  }
}
