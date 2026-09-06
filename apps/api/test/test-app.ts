import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  HealthCheckService,
  MemoryHealthIndicator,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import {
  CreateStoreUseCase,
  CreateWithdrawalUseCase,
  GetWithdrawalUseCase,
  ListStoresUseCase,
  UpdateStoreProfileUseCase,
  ListWithdrawalsUseCase,
  LoginUseCase,
  LogoutUseCase,
  RefreshTokenUseCase,
  GetOperatorUseCase,
  ListOperatorAuditLogsUseCase,
  OperatorLoginUseCase,
  OperatorLogoutUseCase,
  OperatorRefreshTokenUseCase,
  SwitchStoreUseCase,
  TOKEN_AUDIENCE,
  ValidateApiKeyUseCase,
} from '@hockpay/core';
import {
  DomainExceptionFilter,
  HttpExceptionFilter,
  TimeoutInterceptor,
} from '../src/common';
import { IdempotencyInterceptor } from '../src/common/interceptors/idempotency.interceptor';
import { TransactionalIdempotencyService } from '../src/common/idempotency/transactional-idempotency.service';
import {
  getOrCreateRequestId,
  RESPONSE_REQUEST_ID_HEADER,
} from '../src/common/request-id';
import { IdempotencyCacheService } from '../src/infra/services/idempotency-cache.service';
import { JwtService } from '../src/infra/services/jwt.service';
import { IS_PUBLIC_KEY } from '../src/modules/auth/decorators/public.decorator';
import { CombinedAuthGuard } from '../src/modules/auth/guards/combined-auth.guard';
import { AuthController } from '../src/modules/auth/auth.controller';
import { PrismaService } from '../src/infra/database/prisma.service';
import { HealthController } from '../src/modules/health/health.controller';
import { StoreController } from '../src/modules/store/store.controller';
import { WithdrawalController } from '../src/modules/withdrawal/withdrawal.controller';
import { OperatorAuthController } from '../src/modules/operator/operator-auth.controller';
import { OperatorController } from '../src/modules/operator/operator.controller';
import { OperatorAuthGuard } from '../src/modules/operator/guards/operator-auth.guard';
import { IS_OPERATOR_ROUTE_KEY } from '../src/modules/operator/decorators/operator-route.decorator';
import { OperatorJwtService } from '../src/infra/services/operator-jwt.service';

export type ApiE2eMocks = {
  loginUseCase: { execute: jest.Mock };
  refreshTokenUseCase: { execute: jest.Mock };
  logoutUseCase: { execute: jest.Mock };
  switchStoreUseCase: { execute: jest.Mock };
  createStoreUseCase: { execute: jest.Mock };
  listStoresUseCase: { execute: jest.Mock };
  updateStoreProfileUseCase: { execute: jest.Mock };
  createWithdrawalUseCase: { executeInTransaction: jest.Mock };
  listWithdrawalsUseCase: { execute: jest.Mock };
  getWithdrawalUseCase: { execute: jest.Mock };
  transactionalIdempotencyService: { execute: jest.Mock };
  validateApiKeyUseCase: { execute: jest.Mock };
  jwtService: { verifyToken: jest.Mock };
  operatorJwtService: {
    verifyToken: jest.Mock;
    generateAccessToken: jest.Mock;
  };
  operatorLoginUseCase: { execute: jest.Mock };
  operatorRefreshTokenUseCase: { execute: jest.Mock };
  operatorLogoutUseCase: { execute: jest.Mock };
  getOperatorUseCase: { execute: jest.Mock };
  listOperatorAuditLogsUseCase: { execute: jest.Mock };
  idempotencyCacheService: {
    get: jest.Mock;
    set: jest.Mock;
    delete: jest.Mock;
  };
  idempotencyKeyRepository: { findCompleted: jest.Mock };
};

@Injectable()
class TestJwtGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const isOperatorRoute = this.reflector.getAllAndOverride<boolean>(
      IS_OPERATOR_ROUTE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isOperatorRoute) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const accessToken = request.cookies?.hockpay_at;

    if (!accessToken) {
      throw new UnauthorizedException('Unauthorized');
    }

    request.user = {
      sub: 'merchant-1',
      storeId: 'store-1',
      iat: 1,
      exp: 9999999999,
    };

    return true;
  }
}

export async function createApiE2eTestApp(): Promise<{
  app: INestApplication;
  mocks: ApiE2eMocks;
}> {
  const mocks: ApiE2eMocks = {
    loginUseCase: { execute: jest.fn() },
    refreshTokenUseCase: { execute: jest.fn() },
    logoutUseCase: { execute: jest.fn() },
    switchStoreUseCase: { execute: jest.fn() },
    createStoreUseCase: { execute: jest.fn() },
    listStoresUseCase: { execute: jest.fn() },
    updateStoreProfileUseCase: { execute: jest.fn() },
    createWithdrawalUseCase: { executeInTransaction: jest.fn() },
    listWithdrawalsUseCase: { execute: jest.fn() },
    getWithdrawalUseCase: { execute: jest.fn() },
    transactionalIdempotencyService: { execute: jest.fn() },
    validateApiKeyUseCase: { execute: jest.fn() },
    jwtService: {
      verifyToken: jest.fn(async (token: string) => {
        if (token === 'valid-access-token-without-store') {
          return {
            sub: 'merchant-1',
            aud: TOKEN_AUDIENCE.MERCHANT,
            iat: 1,
            exp: 9999999999,
          };
        }

        if (token === 'valid-access-token') {
          return {
            sub: 'merchant-1',
            aud: TOKEN_AUDIENCE.MERCHANT,
            storeId: 'store-1',
            iat: 1,
            exp: 9999999999,
          };
        }

        throw new UnauthorizedException('Invalid token');
      }),
    },
    operatorJwtService: {
      generateAccessToken: jest.fn(),
      verifyToken: jest.fn(async (token: string) => {
        if (token === 'valid-operator-token') {
          return {
            sub: 'operator-1',
            aud: TOKEN_AUDIENCE.OPERATOR,
            iat: 1,
            exp: 9999999999,
          };
        }

        throw new UnauthorizedException('Invalid token');
      }),
    },
    operatorLoginUseCase: { execute: jest.fn() },
    operatorRefreshTokenUseCase: { execute: jest.fn() },
    operatorLogoutUseCase: { execute: jest.fn() },
    getOperatorUseCase: { execute: jest.fn() },
    listOperatorAuditLogsUseCase: { execute: jest.fn() },
    idempotencyCacheService: {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    },
    idempotencyKeyRepository: {
      findCompleted: jest.fn().mockResolvedValue(null),
    },
  };

  const moduleRef = await Test.createTestingModule({
    controllers: [
      HealthController,
      AuthController,
      StoreController,
      WithdrawalController,
      OperatorAuthController,
      OperatorController,
    ],
    providers: [
      {
        provide: APP_GUARD,
        useClass: TestJwtGuard,
      },
      {
        provide: APP_INTERCEPTOR,
        useClass: IdempotencyInterceptor,
      },
      {
        provide: HealthCheckService,
        useValue: {
          check: jest.fn().mockResolvedValue({ status: 'ok' }),
        },
      },
      {
        provide: MemoryHealthIndicator,
        useValue: {
          checkHeap: jest.fn(),
          checkRSS: jest.fn(),
        },
      },
      {
        provide: PrismaHealthIndicator,
        useValue: {
          pingCheck: jest.fn(),
        },
      },
      {
        provide: PrismaService,
        useValue: {},
      },
      {
        provide: JwtService,
        useValue: mocks.jwtService,
      },
      {
        provide: OperatorJwtService,
        useValue: mocks.operatorJwtService,
      },
      OperatorAuthGuard,
      {
        provide: OperatorLoginUseCase,
        useValue: mocks.operatorLoginUseCase,
      },
      {
        provide: OperatorRefreshTokenUseCase,
        useValue: mocks.operatorRefreshTokenUseCase,
      },
      {
        provide: OperatorLogoutUseCase,
        useValue: mocks.operatorLogoutUseCase,
      },
      {
        provide: GetOperatorUseCase,
        useValue: mocks.getOperatorUseCase,
      },
      {
        provide: ListOperatorAuditLogsUseCase,
        useValue: mocks.listOperatorAuditLogsUseCase,
      },
      {
        provide: ValidateApiKeyUseCase,
        useValue: mocks.validateApiKeyUseCase,
      },
      {
        provide: CombinedAuthGuard,
        useClass: CombinedAuthGuard,
      },
      {
        provide: LoginUseCase,
        useValue: mocks.loginUseCase,
      },
      {
        provide: RefreshTokenUseCase,
        useValue: mocks.refreshTokenUseCase,
      },
      {
        provide: LogoutUseCase,
        useValue: mocks.logoutUseCase,
      },
      {
        provide: SwitchStoreUseCase,
        useValue: mocks.switchStoreUseCase,
      },
      {
        provide: CreateStoreUseCase,
        useValue: mocks.createStoreUseCase,
      },
      {
        provide: ListStoresUseCase,
        useValue: mocks.listStoresUseCase,
      },
      {
        provide: UpdateStoreProfileUseCase,
        useValue: mocks.updateStoreProfileUseCase,
      },
      {
        provide: CreateWithdrawalUseCase,
        useValue: mocks.createWithdrawalUseCase,
      },
      {
        provide: ListWithdrawalsUseCase,
        useValue: mocks.listWithdrawalsUseCase,
      },
      {
        provide: GetWithdrawalUseCase,
        useValue: mocks.getWithdrawalUseCase,
      },
      {
        provide: TransactionalIdempotencyService,
        useValue: mocks.transactionalIdempotencyService,
      },
      {
        provide: IdempotencyCacheService,
        useValue: mocks.idempotencyCacheService,
      },
      {
        provide: 'IIdempotencyKeyRepository',
        useValue: mocks.idempotencyKeyRepository,
      },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useLogger(false);
  app.use(helmet());
  app.use((req, res, next) => {
    const requestId = getOrCreateRequestId(req);
    res.setHeader(RESPONSE_REQUEST_ID_HEADER, requestId);
    next();
  });
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new DomainExceptionFilter(), new HttpExceptionFilter());
  app.useGlobalInterceptors(new TimeoutInterceptor(30000));

  await app.init();

  return { app, mocks };
}
