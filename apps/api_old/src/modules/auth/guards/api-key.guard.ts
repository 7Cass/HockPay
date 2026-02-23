import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Environment } from '@hockpay/database';
import { PrismaService } from '../../../infra/database/prisma.service';

/**
 * Guard que autentica requests via API Key
 *
 * Verifica o header `Authorization: Bearer hk_live_...` ou `Authorization: Bearer hk_test_...`
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Extrai o Bearer token do header
    const authorization = request.headers?.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const apiKey = authorization.slice(7); // Remove "Bearer "

    // Valida o formato da API key
    if (!apiKey.startsWith('hk_')) {
      throw new UnauthorizedException('Invalid API key format');
    }

    // Extrai o ambiente da API key
    const parts = apiKey.split('_');
    if (parts.length < 3) {
      throw new UnauthorizedException('Invalid API key format');
    }

    const env = parts[1];
    const environment = env === 'test' ? Environment.TEST : Environment.LIVE;

    // Busca o hash da API key no banco
    const keyHash = await this.hashKey(apiKey);

    const apiKeyRecord = await this.prisma.apiKey.findFirst({
      where: {
        keyHash,
        environment,
        revokedAt: null,
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            isApproved: true,
            merchantId: true,
          },
        },
      },
    });

    if (!apiKeyRecord) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (!apiKeyRecord.store.isActive) {
      throw new UnauthorizedException('Store is inactive');
    }

    if (!apiKeyRecord.store.isApproved) {
      throw new UnauthorizedException('Store is not approved');
    }

    // Atualiza o último uso da API key
    await this.prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() },
    });

    // Injeta a store no request para uso posterior
    request.store = apiKeyRecord.store;

    this.logger.debug(
      `API Key authenticated: ${apiKeyRecord.prefix} for store ${apiKeyRecord.store.id}`,
    );

    return true;
  }

  /**
   * Gera o hash SHA-256 de uma API key
   */
  private async hashKey(key: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}

/**
 * Extende o Request do Express para incluir a store
 */
declare global {
  namespace Express {
    interface Request {
      store?: {
        id: string;
        name: string;
        slug: string;
        isActive: boolean;
        isApproved: boolean;
        merchantId: string;
      };
    }
  }
}
